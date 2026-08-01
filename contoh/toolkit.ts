import "frida-il2cpp-bridge";

export interface IToolkit {
  hookMethodReturn(className: string, methodName: string, forceReturn: any): void;
  blockMethod(className: string, methodName: string): void;
  traceMethodCalls(className: string): void;
  patchObject(instance: Il2Cpp.Object, patch: Record<string, any>, debug?: boolean): void;
  inspect(target: string | Il2Cpp.Object, returnString?: boolean): string | void;
  traceAllMethods(className: string, extraExcludes?: string[], includeBacktrace?: boolean): void;
  _traceLogger: { file: any, active: boolean, log(msg: string): void };
  startTraceLog(customFileName?: string): void;
  stopTraceLog(): void;
  forceArg(className: string, methodName: string, argIndex: number, forcedValue: any): void;
  forceReturn(className: string, methodName: string, forcedValue: any, executeOriginal?: boolean): void;
  _toRawArg(arg: any): any;
  untrace(className: string, methodName: string): void;
  untraceAllMethods(className: string): void;
  _methods: Il2Cpp.Method[];
  resolveAddress(address: NativePointer): string;
  getBacktrace(context?: CpuContext): string;
  pause(): void;
  resume(): void;
  traceMethod(className: string, methodName: string, includeBacktrace?: boolean): void;
  dumpAllInstances(className: string, returnString?: boolean): string | void;
  dumpToFile(className: string, customFileName?: string): void;
  ValueFreezer: {
    _tasks: Map<string, any>,
    start(className: string, instanceHandle?: NativePointer, intervalMs?: number): void,
    _isFreezable(val: any): boolean,
    stop(id?: string): void,
    list(): void
  };
  PersistentFreezer: {
    getFilePath(): string | null,
    save(className: string, instanceHandle?: NativePointer): void,
    remove(className: string): void,
    loadAndApply(): void,
    _readRaw(): Record<string, any>,
    _writeRaw(data: any): void
  };
  PersistentHooks: {
    getFilePath(): string | null,
    save(className: string, methodName: string, forcedValue: any): void,
    remove(className: string, methodName?: string): void,
    loadAndApply(): void,
    _readRaw(): Record<string, any>,
    _writeRaw(data: any): void
  };
  Scanner: {
    candidates: Map<string, any>,
    step: number,
    targetValue: any,
    classNames: string[],
    start(initialValue: any, classNames: string[]): void,
    next(nextValue: any): void,
    filter(): void,
    results(): void,
    stop(): void
  };
  CorrelationScanner: {
    candidates: Map<string, any>,
    targetValues: any[],
    classNames: string[],
    start(values: any[], classNames: string[]): void,
    _findMatch(val: any): any,
    report(): void,
    stop(): void
  };
  ValueCorrelationScanner: {
    scan(values: any[], classNames?: string[]): void
  };
  getAllClassNames(assemblyName?: string): string[];
  findClass(name: string): Il2Cpp.Class | null;
  GGScanner: {
    results: NativePointer[],
    search(value: number): void,
    modify(newValue: number): void
  };
  Unity: {
    freeze(state: boolean): void,
    forceClick(targetName: string): void,
    trackStatus(targetObjName: string): void,
    replaceUIText(searchString: string, replaceString: string): void
  };
  findDataModel(keywords: string[]): void;
  patchGMSandbox(): void;

  // New Methods
  callMethod(className: string, methodName: string, args: any[], instanceHandle?: NativePointer): any;
  getLuaScriptMgr(): Il2Cpp.Object;
  getLuaState(): Il2Cpp.Object;
  getDummyLuaFunction(): Il2Cpp.Object;
  initTipHook(): void;
  showNativeTip(message: string, title: string, confirmText?: string, cancelText?: string): void;

  intercept(className: string, methodName: string, callback: (instance: any, args: any[], original: (...newArgs: any[]) => any) => any): void;

  _tipCallbacks: Map<string, () => void>;
}

export const Toolkit: IToolkit = {
  /**
   * Universal Interceptor: Hook any method and provide a callback to handle the logic.
   * @param callback Function receiving (instance, args, originalFunction)
   */
  intercept(className: string, methodName: string, callback: (instance: any, args: any[], original: (...newArgs: any[]) => any) => any) {
    try {
      const klass = this.findClass(className);
      if (!klass) {
        console.log(`[-] intercept: Class '${className}' not found.`);
        return;
      }

      const methods = klass.methods.filter(m => m.name === methodName);
      if (methods.length === 0) {
        console.log(`[-] intercept: Method '${methodName}' not found in class '${className}'.`);
        return;
      }

      const self = this;
      methods.forEach(method => {
        const isStatic = method.isStatic;
        const nativeFunc = (method as any).nativeFunction;

        if (!nativeFunc) {
          console.log(`[-] intercept: Native function for ${className}::${methodName} not available.`);
          return;
        }

        method.implementation = function (...args: any[]) {
          const instance = (isStatic || this instanceof Il2Cpp.Class) ? this : new Il2Cpp.Object(this.handle);

          // Original caller helper using NativeFunction to avoid recursion
          const original = (...newArgs: any[]) => {
            const finalArgs = newArgs.length > 0 ? newArgs : args;
            const rawArgs = finalArgs.map(a => self._toRawArg(a));
            
            // IL2CPP instance methods usually expect: (this, ...args, methodInfo)
            // Some versions/bridges might not need methodInfo, but it's safer to include if nativeFunc expects it.
            if (isStatic) {
              return nativeFunc(...rawArgs);
            } else {
              const thisPtr = (this as any).handle || this;
              return nativeFunc(thisPtr, ...rawArgs);
            }
          };

          return callback(instance, args, original);
        };
      });
      console.log(`[+] Interceptor installed: ${className}::${methodName}`);
    } catch (e) {
      console.log(`[-] Intercept Error: ${e}`);
    }
  },

  /**
   * Automatically find and patch all methods containing "GM" or "SandBox" 
   * that return a Boolean to always return true.
   */
  patchGMSandbox() {
    console.log("[*] Scanning all assemblies for GM/SandBox boolean targets...");
    let methodCount = 0;
    let fieldCount = 0;

    Il2Cpp.domain.assemblies.forEach(assembly => {
      assembly.image.classes.forEach(klass => {
        // 1. Patch Methods
        klass.methods.forEach(method => {
          const methodName = method.name.toLowerCase();
          const isGMSandbox = methodName.includes("gm") || methodName.includes("sandbox");

          if (isGMSandbox && method.returnType.name.includes("Boolean") && !method.virtualAddress.isNull()) {
            try {
              method.implementation = function () {
                return true as any;
              };
              methodCount++;
            } catch (e) { }
          }
        });

        // 2. Patch Static Fields
        klass.fields.forEach(field => {
          const fieldName = field.name.toLowerCase();
          const isGMSandbox = fieldName.includes("gm") || fieldName.includes("sandbox");

          if (isGMSandbox && field.isStatic && field.type.name.includes("Boolean")) {
            try {
              field.value = true;
              fieldCount++;
            } catch (e) { }
          }
        });
      });
    });

    console.log(`[+] GM/SandBox Patcher complete.`);
    console.log(`    -> Methods Patched: ${methodCount}`);
    console.log(`    -> Static Fields Patched: ${fieldCount}`);
  },

  /**
   * Force a method to always return a specific value across all assemblies.
   */
  hookMethodReturn(className: string, methodName: string, forceReturn: any) {
    try {
      const klass = this.findClass(className);
      if (!klass) {
        console.log(`[-] Error: Class '${className}' not found in any assembly.`);
        return;
      }
      const method = klass.method(methodName);
      method.implementation = function () {
        return forceReturn;
      };
      console.log(`[+] Success: Method '${methodName}' in class '${className}' forced to return: ${forceReturn}.`);
    } catch (e) {
      console.log(`[-] Error hooking ${className}::${methodName}: ${e}`);
    }
  },

  /**
   * Block a method from executing its body across all assemblies.
   */
  blockMethod(className: string, methodName: string) {
    try {
      const klass = this.findClass(className);
      if (!klass) {
        console.log(`[-] Error: Class '${className}' not found.`);
        return;
      }
      const method = klass.method(methodName);
      method.implementation = function () {
        return;
      };
      console.log(`[X] Setter Blocked: ${className}::${methodName}`);
    } catch (e) {
      console.log(`[-] Error blocking ${className}::${methodName}: ${e}`);
    }
  },

  /**
   * Trace all method calls in a class across all assemblies.
   */
  traceMethodCalls(className: string) {
    try {
      const klass = this.findClass(className);
      if (!klass) {
        console.log(`[-] Error: Class '${className}' not found.`);
        return;
      }
      Il2Cpp.trace().classes(klass).and().attach();
    } catch (e) {
      console.log(`[-] Error tracing ${className}: ${e}`);
    }
  },

  /**
   * Patch fields of an Il2Cpp.Object instance.
   */
  patchObject(instance: Il2Cpp.Object, patch: Record<string, any>, debug: boolean = false) {
    Object.entries(patch).forEach(([key, value]) => {
      try {
        const field = instance.field(key);
        if (typeof value === "string") {
          field.value = Il2Cpp.string(value);
        } else {
          field.value = value;
        }
        if (debug) console.log(`[+] Patched Field: ${key} -> ${value}`);
      } catch (e) {
        if (debug) console.log(`[-] Failed to patch field: ${key}`);
      }
    });
  },

  /**
   * Universal Inspector: Dump all fields (with values) and methods of a class or instance.
   */
  inspect(target: string | Il2Cpp.Object, returnString: boolean = false): string | void {
    let instance: Il2Cpp.Object | undefined;
    let klass: Il2Cpp.Class | null = null;
    let output: string[] = [];

    const log = (msg: string) => {
      if (returnString) output.push(msg);
      else console.log(msg);
    };

    if (typeof target === "string") {
      klass = this.findClass(target);
    } else {
      instance = target;
      klass = instance.class;
    }

    if (!klass) {
      log(`[-] Error: Inspector target not found.`);
      return returnString ? output.join("\n") : undefined;
    }

    log(`\n=== INSPECTING: ${klass.fullName} ${instance ? `(@ ${instance.handle})` : '(Static Only)'} ===`);

    log(`--- FIELDS ---`);
    klass.fields.forEach(f => {
      try {
        let val: any = "N/A";
        if (f.isStatic) {
          val = f.value;
        } else if (instance) {
          val = instance.field(f.name).value;
        }

        let typeStr = f.type.name;
        let valStr = "null";

        if (val !== null && val !== undefined) {
          if (val instanceof Il2Cpp.Object) {
            valStr = `[Object ${val.class.name} @ ${val.handle}]`;
          } else if (val instanceof Il2Cpp.String) {
            valStr = `"${val.content}"`;
          } else {
            valStr = val.toString();
          }
        }
        log(`  [Field] ${f.isStatic ? 'static ' : ''}${typeStr} ${f.name} = ${valStr}`);
      } catch (e) { }
    });

    log(`\n--- METHODS (Use trace() to see return values) ---`);
    klass.methods.forEach(m => {
      try {
        const params = m.parameters.map(p => `${p.type.name} ${p.name}`).join(", ");
        log(`  [Method] ${m.isStatic ? 'static ' : ''}${m.returnType.name} ${m.name}(${params})`);
      } catch (e) { }
    });
    log(`====================================================\n`);

    if (returnString) return output.join("\n");
  },

  /**
   * Trace All Methods: Attach a tracer to EVERY method in a class.
   * @param extraExcludes Additional method names to skip.
   */
  traceAllMethods(className: string, extraExcludes: string[] = [], includeBacktrace: boolean = false) {
    const klass = this.findClass(className);
    if (!klass) return;

    // Daftar default method yang biasanya spam/berisik di MLBB
    const defaultExcludes = [
      "Update", "LateUpdate", "FixedUpdate", "OnGUI", "OnRenderObject",
      "get_transform", "get_gameObject", "get_enabled", "set_enabled",
      "get_name", "ToString", "GetHashCode", "Equals"
    ];

    const finalExcludes = [...defaultExcludes, ...extraExcludes];
    let count = 0;

    console.log(`[*] Attaching tracers to all methods in '${className}'...`);
    console.log(`[*] Excluding ${finalExcludes.length} noisy methods.`);

    klass.methods.forEach(method => {
      if (finalExcludes.includes(method.name)) return;
      try {
        if (!method.virtualAddress.isNull()) {
          this.traceMethod(className, method.name, includeBacktrace);
          count++;
        }
      } catch (e) { }
    });

    console.log(`[+] Successfully attached to ${count} methods in ${className}.`);
  },

  /**
   * Persistent Trace Logger: Buffers and saves trace output to a file.
   */
  _traceLogger: {
    file: null as any,
    active: false,
    log(msg: string) {
      if (this.active && this.file) {
        this.file.write(msg + "\n");
        this.file.flush();
      }
      console.log(msg);
    }
  },

  startTraceLog(customFileName?: string) {
    try {
      const dataPath = Il2Cpp.application.dataPath;
      if (!dataPath) return;
      const fileName = customFileName || `trace_log_${Date.now()}.txt`;
      const fullPath = dataPath + "/" + fileName;
      this._traceLogger.file = new (File as any)(fullPath, "w");
      this._traceLogger.active = true;
      console.log(`[📝] Trace Logging ENABLED -> ${fullPath}`);
    } catch (e) {
      console.log(`[-] Failed to start trace log: ${e}`);
    }
  },

  stopTraceLog() {
    if (this._traceLogger.file) {
      this._traceLogger.file.close();
      this._traceLogger.file = null;
    }
    this._traceLogger.active = false;
    console.log(`[📝] Trace Logging DISABLED.`);
  },

  /**
   * Force Argument: Intercept a method and force a specific argument to a fixed value.
   */
  forceArg(className: string, methodName: string, argIndex: number, forcedValue: any) {
    try {
      const klass = this.findClass(className);
      if (!klass) return;

      const methods = klass.methods.filter(m => m.name === methodName);
      if (methods.length === 0) return;

      const self = this;
      methods.forEach(method => {
        const isStatic = method.isStatic;
        method.implementation = function (...args: any[]) {
          const oldValue = args[argIndex];
          let newValue = forcedValue;

          // String Handling
          if (typeof newValue === "string" && (oldValue instanceof Il2Cpp.String)) {
            newValue = Il2Cpp.string(newValue);
          }

          args[argIndex] = newValue;

          let oldStr = oldValue instanceof Il2Cpp.String ? `"${oldValue.content}"` : oldValue;
          let newStr = newValue instanceof Il2Cpp.String ? `"${newValue.content}"` : newValue;
          self._traceLogger.log(`\n[🛠️ FORCE] ${className}::${methodName} Arg[${argIndex}]: ${oldStr} -> ${newStr}`);

          // Universal Resilient Invocation
          let result: any;
          try {
            const safeInstance = (isStatic || this instanceof Il2Cpp.Class) ? this : new Il2Cpp.Object(this.handle);
            result = isStatic ? method.invoke(...args) : method.invoke(safeInstance as any, ...args);
          } catch (e) {
            const nativeMethod = (method as any).nativeFunction;
            if (nativeMethod) {
              const rawArgs = args.map(a => self._toRawArg(a));
              const thisPtr = isStatic ? undefined : (this as any).handle || this;
              result = isStatic ? nativeMethod(...rawArgs) : nativeMethod(thisPtr, ...rawArgs);
            }
          }
          return result;
        };
      });
      console.log(`[+] ForceArg active: ${className}::${methodName} (Arg[${argIndex}] is now dynamic)`);
    } catch (e) {
      console.log(`[-] ForceArg Error: ${e}`);
    }
  },

  /**
   * Force Return Value: Intercept a method and force it to return a specific value.
   * @param executeOriginal If true, the original method is executed first (for its side effects) before returning the forced value.
   */
  forceReturn(className: string, methodName: string, forcedValue: any, executeOriginal: boolean = true) {
    try {
      const klass = this.findClass(className);
      if (!klass) return;

      const methods = klass.methods.filter(m => m.name === methodName);
      if (methods.length === 0) return;

      const self = this;
      methods.forEach(method => {
        const isStatic = method.isStatic;
        method.implementation = function (...args: any[]) {
          if (executeOriginal) {
            try {
              const safeInstance = (isStatic || this instanceof Il2Cpp.Class) ? this : new Il2Cpp.Object(this.handle);
              isStatic ? method.invoke(...args) : method.invoke(safeInstance as any, ...args);
            } catch (e) {
              const nativeMethod = (method as any).nativeFunction;
              if (nativeMethod) {
                const rawArgs = args.map(a => self._toRawArg(a));
                const thisPtr = isStatic ? undefined : (this as any).handle || this;
                isStatic ? nativeMethod(...rawArgs) : nativeMethod(thisPtr, ...rawArgs);
              }
            }
          }
          let retStr = forcedValue instanceof Il2Cpp.String ? `"${forcedValue.content}"` : forcedValue;
          self._traceLogger.log(`\n[🛠️ FORCE RET] ${className}::${methodName} -> Forcing return: ${retStr}`);
          return (typeof forcedValue === "string" && !forcedValue.startsWith("0x")) ? Il2Cpp.string(forcedValue) : forcedValue;
        };
      });
      console.log(`[+] ForceReturn active: ${className}::${methodName} (Returning: ${forcedValue})`);
    } catch (e) {
      console.log(`[-] ForceReturn Error: ${e}`);
    }
  },

  _toRawArg(arg: any): any {
    if (arg === null || arg === undefined) return NULL;
    if (arg === true) return 1;
    if (arg === false) return 0;
    if (arg instanceof Il2Cpp.Object) return arg.handle;
    if (arg instanceof Il2Cpp.String) return arg.handle;
    return arg;
  },

  /**
   * Untrace: Stop tracing a specific method and restore original performance.
   */
  untrace(className: string, methodName: string) {
    try {
      const klass = this.findClass(className);
      if (!klass) return;
      const method = klass.method(methodName);
      (method as any).implementation = null;
      console.log(`[X] Tracer REMOVED for ${className}::${methodName}`);
    } catch (e) { }
  },

  untraceAllMethods(className: string) {
    const klass = this.findClass(className);
    if (!klass) return;

    klass.methods.forEach(method => {
      try {
        (method as any).implementation = null;
      } catch (e) { }
    });
    console.log(`[X] All tracers REMOVED for ${className}`);
  },

  /**
   * Cached list of all IL2CPP methods for fast address resolution.
   */
  _methods: [] as Il2Cpp.Method[],

  /**
   * Resolve a memory address to an IL2CPP method name.
   */
  resolveAddress(address: NativePointer): string {
    if (this._methods.length === 0) {
      try {
        const methods: Il2Cpp.Method[] = [];
        for (const assembly of Il2Cpp.domain.assemblies) {
          for (const klass of assembly.image.classes) {
            for (const method of klass.methods) {
              if (!method.virtualAddress.isNull()) {
                methods.push(method);
              }
            }
          }
        }
        this._methods = methods.sort((a, b) => a.virtualAddress.compare(b.virtualAddress));
        if (this._methods.length > 0) {
          console.log(`[+] Toolkit: Method cache initialized with ${this._methods.length} methods.`);
          const first = this._methods[0];
          const last = this._methods[this._methods.length - 1];
          if (first && last) {
            console.log(`[+] IL2CPP Range: ${first.virtualAddress} - ${last.virtualAddress}`);
          }
        }
      } catch (e) {
        console.log(`[-] Toolkit: Failed to initialize method cache: ${e}`);
      }
    }

    const il2cppBase = Il2Cpp.module.base;
    const il2cppEnd = il2cppBase.add(Il2Cpp.module.size);

    if (this._methods.length > 0) {
      let left = 0;
      let right = this._methods.length - 1;

      // Check if address is within IL2CPP module range at all
      if (address.compare(il2cppBase) >= 0 && address.compare(il2cppEnd) < 0) {
        while (left <= right) {
          const pivot = Math.floor((left + right) / 2);
          const m = this._methods[pivot];
          if (!m) break;

          const comparison = m.virtualAddress.compare(address);
          if (comparison === 0) return `${m.class.name}::${m.name} (RVA: 0x${m.relativeVirtualAddress.toString(16)})`;
          if (comparison > 0) right = pivot - 1;
          else left = pivot + 1;
        }

        if (right >= 0) {
          const m = this._methods[right];
          if (m) {
            const offset = address.sub(m.virtualAddress);
            const nextM = this._methods[right + 1];
            let isWithin = false;

            if (nextM) {
              isWithin = address.compare(nextM.virtualAddress) < 0;
            } else {
              isWithin = offset.toUInt32() < 0x10000; // Larger threshold for last method
            }

            if (isWithin) {
              return `${m.class.name}::${m.name}+0x${offset.toString(16)} (RVA: 0x${m.relativeVirtualAddress.add(offset).toString(16)})`;
            }
          }
        }
      }
    }

    // Fallback: Check which module this address belongs to
    const mod = Process.findModuleByAddress(address);
    if (mod) {
      const rva = address.sub(mod.base);
      const sym = DebugSymbol.fromAddress(address);
      if (sym.name) {
        return `${mod.name}!${sym.name} (RVA: 0x${rva.toString(16)})`;
      }
      return `${mod.name}+0x${rva.toString(16)} (RVA: 0x${rva.toString(16)})`;
    }

    return address.toString();
  },

  /**
   * Get human-readable backtrace with resolved IL2CPP names.
   */
  getBacktrace(context?: CpuContext): string {
    let handles = Thread.backtrace(context, Backtracer.ACCURATE);
    if (handles.length === 0) {
      handles = Thread.backtrace(context, Backtracer.FUZZY);
    }
    return handles.map(h => `  at ${this.resolveAddress(h)} [${h}]`).join("\n");
  },

  /**
   * Hard Pause: Suspend all threads except the current Frida thread.
   * Total freeze of all memory changes.
   */
  pause() {
    const currentThreadId = Process.getCurrentThreadId();
    let count = 0;
    Process.enumerateThreads().forEach(t => {
      if (t.id !== currentThreadId) {
        try {
          (Thread as any).suspend(t.id);
          count++;
        } catch (e) { }
      }
    });
    console.log(`[🛑] Hard Pause: ${count} threads suspended.`);
  },

  /**
   * Resume all threads.
   */
  resume() {
    let count = 0;
    Process.enumerateThreads().forEach(t => {
      try {
        (Thread as any).resume(t.id);
        count++;
      } catch (e) { }
    });
    console.log(`[▶️] Hard Resume: ${count} threads resumed.`);
  },

  /**
   * Method Tracer: Log arguments and return values of a method in real-time.
   */
  traceMethod(className: string, methodName: string, includeBacktrace: boolean = false) {
    try {
      const klass = this.findClass(className);
      if (!klass) return;

      const methods = klass.methods.filter(m => m.name === methodName);
      if (methods.length === 0) {
        console.log(`[-] Method '${methodName}' not found in class '${className}'.`);
        return;
      }

      const self = this;
      methods.forEach(method => {
        const isStatic = method.isStatic;

        method.implementation = function (...args: any[]) {
          const timestamp = new Date().toLocaleTimeString();
          const instance = this;

          let header = `\n[🔔 ${timestamp}] ${className}::${methodName}`;
          if (instance instanceof Il2Cpp.Object && !(instance instanceof Il2Cpp.Class)) {
            header += ` (@ ${instance.handle})`;
          } else {
            header += ` (Class Context)`;
          }
          self._traceLogger.log(header + " called");

          if (includeBacktrace) {
            self._traceLogger.log("--- BACKTRACE ---");
            self._traceLogger.log(self.getBacktrace());
            self._traceLogger.log("-----------------");
          }

          // Log Arguments
          args.forEach((arg, i) => {
            let argStr = "null";
            if (arg !== null && arg !== undefined) {
              if (arg instanceof Il2Cpp.Object) argStr = `[Object ${arg.class.name} @ ${arg.handle}]`;
              else if (arg instanceof Il2Cpp.String) argStr = `"${arg.content}"`;
              else argStr = arg.toString();
            }
            self._traceLogger.log(`    -> Arg[${i}]: ${argStr}`);
          });

          // Execute Original Method with Universal Resilient Invocation
          let result: any;
          try {
            if (isStatic) {
              result = method.invoke(...args);
            } else {
              // Mencoba invoke standar dulu
              const safeInstance = (instance instanceof Il2Cpp.Class) ? new Il2Cpp.Object(instance.handle) : instance;
              result = method.invoke(safeInstance as any, ...args);
            }
          } catch (e: any) {
            // Jika invoke standar gagal, gunakan pemanggilan Native mentah (bypass semua proteksi)
            self._traceLogger.log(`    [!] Bridge Invoke failed, attempting Raw Native call...`);
            try {
              const nativeMethod = (method as any).nativeFunction;
              if (nativeMethod) {
                const rawArgs = args.map(a => self._toRawArg(a));
                if (isStatic) {
                  result = nativeMethod(...rawArgs);
                } else {
                  const thisPtr = (instance as any).handle || instance;
                  result = nativeMethod(thisPtr, ...rawArgs);
                }
              } else {
                throw e; // Menyerah jika nativeFunction juga tidak tersedia
              }
            } catch (e2: any) {
              self._traceLogger.log(`    [!] Raw Native call also failed: ${e2.message}`);
              return; // Mencegah crash total
            }
          }

          // Log Return Value
          let resStr = "null";
          if (result !== null && result !== undefined) {
            if (result instanceof Il2Cpp.Object) resStr = `[Object ${result.class.name} @ ${result.handle}]`;
            else if (result instanceof Il2Cpp.String) resStr = `"${result.content}"`;
            else resStr = result.toString();
          }

          self._traceLogger.log(`    <- Return: ${resStr}`);
          return result;
        };
      });
      console.log(`[+] Tracer active for ${className}::${methodName}`);
    } catch (e) {
      console.log(`[-] Trace Error: ${e}`);
    }
  },

  /**
   * Find and dump all active instances of a class in memory.
   * @param returnString If true, returns the output as a string instead of logging to console.
   */
  dumpAllInstances(className: string, returnString: boolean = false): string | void {
    const klass = this.findClass(className);
    let output: string[] = [];
    const log = (msg: string) => {
      if (returnString) {
        output.push(msg);
      } else {
        this._traceLogger.log(msg);
      }
    };

    if (!klass) {
      log(`[-] Class '${className}' not found.`);
      return returnString ? output.join("\n") : undefined;
    }

    log(`[*] Searching for active instances of '${className}'...`);
    const instances = Il2Cpp.gc.choose(klass);

    if (instances.length === 0) {
      log(`[-] No active instances of '${className}' found in memory.`);
      const staticInfo = this.inspect(className, returnString);
      if (returnString && staticInfo) output.push(staticInfo as string);
      return returnString ? output.join("\n") : undefined;
    }

    log(`[+] Found ${instances.length} instance(s). Dumping...`);
    instances.forEach((instance: Il2Cpp.Object, index: number) => {
      log(`\n--- Instance #${index + 1} ---`);
      const instInfo = this.inspect(instance, returnString);
      if (returnString && instInfo) output.push(instInfo as string);
    });

    if (returnString) return output.join("\n");
  },

  /**
   * Dumps all instances of a class and saves the output to a file in the game's data directory.
   */
  dumpToFile(className: string, customFileName?: string) {
    try {
      const dataPath = Il2Cpp.application.dataPath;
      if (!dataPath) {
        console.log("[-] Error: Could not determine application data path.");
        return;
      }

      console.log(`[*] Generating dump for '${className}'... Please wait.`);
      const dumpContent = this.dumpAllInstances(className, true) as string;

      const fileName = customFileName || `dump_${className.replace(/\./g, "_")}_${Date.now()}.txt`;
      const fullPath = dataPath + "/" + fileName;

      const file = new (File as any)(fullPath, "w");
      file.write(dumpContent);
      file.flush();
      file.close();

      console.log(`[+] SUCCESS: Dump saved to ${fullPath}`);
    } catch (e) {
      console.log(`[-] Error saving dump to file: ${e}`);
    }
  },

  /**
   * Value Freezer: Periodically restores field values to a captured snapshot.
   * Prevents the game from modifying specific values.
   */
  ValueFreezer: {
    _tasks: new Map<string, { interval: any, snapshot: Map<string, any>, target: any }>(),

    start(className: string, instanceHandle?: NativePointer, intervalMs: number = 500) {
      const klass = Toolkit.findClass(className);
      if (!klass) return console.log(`[-] Class '${className}' not found.`);

      const id = instanceHandle ? `${className}_${instanceHandle}` : className;
      if (this._tasks.has(id)) this.stop(id);

      const snapshot = new Map<string, any>();
      const isStatic = !instanceHandle;
      const target = instanceHandle ? new Il2Cpp.Object(instanceHandle) : null;

      // Capture Snapshot
      klass.fields.forEach(f => {
        try {
          if (isStatic && f.isStatic) {
            const val = f.value;
            if (this._isFreezable(val)) snapshot.set(f.name, val);
          } else if (!isStatic && !f.isStatic && target) {
            const val = target.field(f.name).value;
            if (this._isFreezable(val)) snapshot.set(f.name, val);
          }
        } catch (e) { }
      });

      if (snapshot.size === 0) {
        return console.log(`[-] No compatible fields found to freeze in ${className}.`);
      }

      console.log(`[❄️] Freezing ${snapshot.size} fields in ${className}${instanceHandle ? ` (@ ${instanceHandle})` : ' (Static)'}...`);

      const interval = setInterval(() => {
        Il2Cpp.perform(() => {
          try {
            snapshot.forEach((value, fieldName) => {
              if (isStatic) {
                klass.field(fieldName).value = value;
              } else if (target) {
                target.field(fieldName).value = value;
              }
            });
          } catch (e) {
            this.stop(id);
            console.log(`[!] Freezer ${id} stopped due to error: ${e}`);
          }
        });
      }, intervalMs);

      this._tasks.set(id, { interval, snapshot, target });
    },

    _isFreezable(val: any): boolean {
      const type = typeof val;
      return type === "number" || type === "boolean" || type === "string" || val instanceof Il2Cpp.String;
    },

    stop(id?: string) {
      if (id) {
        const task = this._tasks.get(id);
        if (task) {
          clearInterval(task.interval);
          this._tasks.delete(id);
          console.log(`[🔥] Stopped freezing for: ${id}`);
        }
      } else {
        this._tasks.forEach((task, key) => clearInterval(task.interval));
        this._tasks.clear();
        console.log(`[🔥] Stopped ALL freezing tasks.`);
      }
    },

    list() {
      console.log(`\n=== ACTIVE FREEZERS ===`);
      this._tasks.forEach((task, id) => {
        console.log(`  -> ${id} (${task.snapshot.size} fields)`);
      });
      console.log("=======================\n");
    }
  },

  /**
   * Persistent Freezer: Saves and loads frozen values to/from a JSON file.
   */
  PersistentFreezer: {
    getFilePath() {
      const dataPath = Il2Cpp.application.dataPath;
      return dataPath ? dataPath + "/persistent_freezer.json" : null;
    },

    save(className: string, instanceHandle?: NativePointer) {
      if (instanceHandle) {
        return console.log("[-] Persistence currently only supports static fields (classes). Instance handles change every session.");
      }

      const klass = Toolkit.findClass(className);
      if (!klass) return;

      const snapshot: Record<string, any> = {};
      klass.fields.forEach(f => {
        if (f.isStatic) {
          try {
            const val = f.value;
            if (Toolkit.ValueFreezer._isFreezable(val)) {
              snapshot[f.name] = (val instanceof Il2Cpp.String) ? val.content : val;
            }
          } catch (e) { }
        }
      });

      if (Object.keys(snapshot).length === 0) return;

      let data: Record<string, any> = this._readRaw();
      data[className] = snapshot;
      this._writeRaw(data);

      console.log(`[💾] Persistent: Saved static snapshot for ${className}.`);
      // Also start active freezing
      Toolkit.ValueFreezer.start(className);
    },

    remove(className: string) {
      let data = this._readRaw();
      if (data[className]) {
        delete data[className];
        this._writeRaw(data);
        Toolkit.ValueFreezer.stop(className);
        console.log(`[🗑️] Persistent: Removed ${className}.`);
      }
    },

    loadAndApply() {
      const data = this._readRaw();
      const classes = Object.keys(data);
      if (classes.length === 0) return;

      console.log(`[📦] Persistent: Loading ${classes.length} patched classes...`);

      classes.forEach(className => {
        const snapshot = data[className];
        const klass = Toolkit.findClass(className);
        if (!klass) return;

        // Apply once immediately
        Object.entries(snapshot).forEach(([field, val]) => {
          try {
            const f = klass.field(field) as any;
            if (typeof val === "string" && f.type.name.includes("String")) {
              f.value = Il2Cpp.string(val);
            } else {
              f.value = val;
            }
          } catch (e) { }
        });

        // Start background freezer
        Toolkit.ValueFreezer.start(className);
      });
    },

    _readRaw(): Record<string, any> {
      try {
        const path = this.getFilePath();
        if (!path) return {};
        const file = new (File as any)(path, "r");
        const content = file.readAll();
        file.close();
        return JSON.parse(content);
      } catch (e) { return {}; }
    },

    _writeRaw(data: any) {
      try {
        const path = this.getFilePath();
        if (!path) return;
        const file = new (File as any)(path, "w");
        file.write(JSON.stringify(data, null, 2));
        file.flush();
        file.close();
      } catch (e) { }
    }
  },

  /**
   * Persistent Hooks: Saves and loads method return value overrides.
   */
  PersistentHooks: {
    getFilePath() {
      const dataPath = Il2Cpp.application.dataPath;
      return dataPath ? dataPath + "/persistent_hooks.json" : null;
    },

    save(className: string, methodName: string, forcedValue: any) {
      const klass = Toolkit.findClass(className);
      if (!klass) return console.log(`[-] Class '${className}' not found.`);

      try {
        klass.method(methodName); // Validate method exists
      } catch (e) {
        return console.log(`[-] Method '${methodName}' not found in ${className}.`);
      }

      let data: Record<string, any> = this._readRaw();
      if (!data[className]) data[className] = {};
      data[className][methodName] = forcedValue;
      this._writeRaw(data);

      console.log(`[💾] Persistent Hook: Saved ${className}::${methodName} -> ${forcedValue}`);
      // Apply immediately
      Toolkit.forceReturn(className, methodName, forcedValue);
    },

    remove(className: string, methodName?: string) {
      let data = this._readRaw();
      if (data[className]) {
        if (methodName) {
          if (data[className][methodName]) {
            delete data[className][methodName];
            Toolkit.untrace(className, methodName);
            console.log(`[🗑️] Persistent Hook: Removed ${className}::${methodName}`);
          }
        } else {
          delete data[className];
          Toolkit.untraceAllMethods(className);
          console.log(`[🗑️] Persistent Hook: Removed all hooks for ${className}`);
        }
        this._writeRaw(data);
      }
    },

    loadAndApply() {
      const data = this._readRaw();
      const classes = Object.keys(data);
      if (classes.length === 0) return;

      console.log(`[📦] Persistent Hooks: Loading ${classes.length} hooked classes...`);

      classes.forEach(className => {
        const methods = data[className];
        Object.entries(methods).forEach(([methodName, value]) => {
          try {
            Toolkit.forceReturn(className, methodName, value);
          } catch (e) { }
        });
      });
    },

    _readRaw(): Record<string, any> {
      try {
        const path = this.getFilePath();
        if (!path) return {};
        const file = new (File as any)(path, "r");
        const content = file.readAll();
        file.close();
        return JSON.parse(content);
      } catch (e) { return {}; }
    },

    _writeRaw(data: any) {
      try {
        const path = this.getFilePath();
        if (!path) return;
        const file = new (File as any)(path, "w");
        file.write(JSON.stringify(data, null, 2));
        file.flush();
        file.close();
      } catch (e) { }
    }
  },

  /**
   * Game Guardian Style Argument and Return Value Scanner
   * Tracks values passed into or returned from methods across multiple steps.
   */
  Scanner: {
    candidates: new Map<string, { className: string, methodName: string, type: 'arg' | 'return', index?: number, lastSeen: any }>(),
    step: 0,
    targetValue: null as any,
    classNames: [] as string[],

    start(initialValue: any, classNames: string[]) {
      this.step = 1;
      this.targetValue = initialValue;
      this.candidates.clear();
      this.classNames = classNames;

      console.log(`\n[🔍 SCANNER] Step 1: Searching for '${initialValue}' in ${classNames.length} classes...`);
      console.log(`[*] Please interact with the game. Methods using this value will be logged.`);

      classNames.forEach(className => {
        const klass = Toolkit.findClass(className);
        if (!klass) return;

        klass.methods.forEach(method => {
          // OPTIMIZATIONS & SAFETY CHECKS:
          // 1. Skip if no virtual address (can't hook)
          if (method.virtualAddress.isNull()) return;

          // 2. Skip constructors (rarely useful for value tracking and often cause issues)
          if (method.name === ".cctor" || method.name === ".ctor") return;

          // 3. Skip methods that can't possibly hold our value (0 args AND void return)
          if (method.parameterCount === 0 && method.returnType.name === "System.Void") return;

          const methodKey = `${className}::${method.name}`;
          const isStatic = method.isStatic;

          try {
            method.implementation = function (...args: any[]) {
              // Cek Args
              args.forEach((arg, i) => {
                if (arg == Toolkit.Scanner.targetValue || (arg && arg.toString() == Toolkit.Scanner.targetValue.toString())) {
                  const key = `${methodKey}_Arg${i}`;
                  if (!Toolkit.Scanner.candidates.has(key) && Toolkit.Scanner.step === 1) {
                    Toolkit.Scanner.candidates.set(key, { className, methodName: method.name, type: 'arg', index: i, lastSeen: arg });
                    Toolkit._traceLogger.log(`  [+] Candidate Found: ${className}::${method.name} (Arg[${i}])`);
                  } else if (Toolkit.Scanner.candidates.has(key) && Toolkit.Scanner.step > 1) {
                    Toolkit.Scanner.candidates.get(key)!.lastSeen = arg;
                  }
                }
              });

              // Eksekusi asli dengan Universal Invoker
              let result: any;
              try {
                const safeInstance = (isStatic || this instanceof Il2Cpp.Class) ? this : new Il2Cpp.Object(this.handle);
                result = isStatic ? method.invoke(...args) : method.invoke(safeInstance as any, ...args);
              } catch (e) {
                const nativeMethod = (method as any).nativeFunction;
                if (nativeMethod) {
                  const rawArgs = args.map(a => Toolkit._toRawArg(a));
                  const thisPtr = isStatic ? undefined : (this as any).handle || this;
                  result = isStatic ? nativeMethod(...rawArgs) : nativeMethod(thisPtr, ...rawArgs);
                }
              }

              // Cek Return
              if (result == Toolkit.Scanner.targetValue || (result && result.toString() == Toolkit.Scanner.targetValue.toString())) {
                const key = `${methodKey}_Return`;
                if (!Toolkit.Scanner.candidates.has(key) && Toolkit.Scanner.step === 1) {
                  Toolkit.Scanner.candidates.set(key, { className, methodName: method.name, type: 'return', lastSeen: result });
                  Toolkit._traceLogger.log(`  [+] Candidate Found: ${className}::${method.name} (Return)`);
                } else if (Toolkit.Scanner.candidates.has(key) && Toolkit.Scanner.step > 1) {
                  Toolkit.Scanner.candidates.get(key)!.lastSeen = result;
                }
              }

              return result;
            };
          } catch (e) {
            // Abaikan method yang tidak bisa di-hook (thunks, dsb)
          }
        });
      });
    },

    next(nextValue: any) {
      if (this.step === 0) return console.log("[-] Please run Scanner.start() first.");
      this.step++;
      this.targetValue = nextValue;
      console.log(`\n[🔍 SCANNER] Step ${this.step}: Tracking value changed to '${nextValue}'...`);
      console.log(`[*] Interact with the game again. Then type 'Scanner.filter()' to narrow down results.`);
    },

    filter() {
      if (this.step === 0) return;
      let removed = 0;
      for (const [key, cand] of this.candidates.entries()) {
        if (cand.lastSeen != this.targetValue && (!cand.lastSeen || cand.lastSeen.toString() != this.targetValue.toString())) {
          this.candidates.delete(key);
          removed++;
        }
      }
      console.log(`\n[🔍 SCANNER] Filtering complete. Removed ${removed} candidates.`);
      this.results();
    },

    results() {
      console.log(`\n=== SCANNER RESULTS (${this.candidates.size} Candidates) ===`);
      this.candidates.forEach(cand => {
        if (cand.type === 'arg') {
          console.log(`  -> Class: ${cand.className} | Method: ${cand.methodName} | Type: Argument [${cand.index}]`);
        } else {
          console.log(`  -> Class: ${cand.className} | Method: ${cand.methodName} | Type: Return Value`);
        }
      });
      console.log("=========================================\n");
    },

    stop() {
      console.log("[*] Scanner stopped. Cleaning up hooks...");
      this.classNames.forEach(c => Toolkit.untraceAllMethods(c));
      this.step = 0;
      this.candidates.clear();
    }
  },

  /**
   * Correlation Scanner: Tracks multiple values across method calls.
   * Useful for finding methods that handle a set of related IDs (e.g., player IDs in a lobby).
   */
  CorrelationScanner: {
    candidates: new Map<string, {
      className: string,
      methodName: string,
      type: 'arg' | 'return',
      index?: number,
      matchedValues: Set<any>
    }>(),
    targetValues: [] as any[],
    classNames: [] as string[],

    start(values: any[], classNames: string[]) {
      this.targetValues = values;
      this.classNames = classNames;
      this.candidates.clear();

      console.log(`\n[🔗 CORRELATION SCANNER] Starting with ${values.length} values: [${values.join(", ")}]`);
      console.log(`[*] Monitoring ${classNames.length} classes...`);

      classNames.forEach(className => {
        const klass = Toolkit.findClass(className);
        if (!klass) return;

        klass.methods.forEach(method => {
          if (method.virtualAddress.isNull()) return;
          if (method.name === ".cctor" || method.name === ".ctor") return;
          if (method.parameterCount === 0 && method.returnType.name === "System.Void") return;

          const methodKey = `${className}::${method.name}`;
          const isStatic = method.isStatic;

          try {
            method.implementation = function (...args: any[]) {
              // Check Args
              args.forEach((arg, i) => {
                const match = Toolkit.CorrelationScanner._findMatch(arg);
                if (match !== undefined) {
                  const key = `${methodKey}_Arg${i}`;
                  if (!Toolkit.CorrelationScanner.candidates.has(key)) {
                    Toolkit.CorrelationScanner.candidates.set(key, { className, methodName: method.name, type: 'arg', index: i, matchedValues: new Set() });
                  }
                  Toolkit.CorrelationScanner.candidates.get(key)!.matchedValues.add(match);
                }
              });

              // Execute
              let result: any;
              try {
                const safeInstance = (isStatic || this instanceof Il2Cpp.Class) ? this : new Il2Cpp.Object(this.handle);
                result = isStatic ? method.invoke(...args) : method.invoke(safeInstance as any, ...args);
              } catch (e) {
                const nativeMethod = (method as any).nativeFunction;
                if (nativeMethod) {
                  const rawArgs = args.map(a => Toolkit._toRawArg(a));
                  const thisPtr = isStatic ? undefined : (this as any).handle || this;
                  result = isStatic ? nativeMethod(...rawArgs) : nativeMethod(thisPtr, ...rawArgs);
                }
              }

              // Check Return
              const matchRet = Toolkit.CorrelationScanner._findMatch(result);
              if (matchRet !== undefined) {
                const key = `${methodKey}_Return`;
                if (!Toolkit.CorrelationScanner.candidates.has(key)) {
                  Toolkit.CorrelationScanner.candidates.set(key, { className, methodName: method.name, type: 'return', matchedValues: new Set() });
                }
                Toolkit.CorrelationScanner.candidates.get(key)!.matchedValues.add(matchRet);
              }

              return result;
            };
          } catch (e) { }
        });
      });
    },

    _findMatch(val: any): any | undefined {
      if (val === null || val === undefined) return undefined;
      const targetStr = val.toString();
      return this.targetValues.find(v => val == v || targetStr == v.toString());
    },

    report() {
      console.log(`\n=== CORRELATION SCANNER RESULTS (${this.candidates.size} Candidates) ===`);
      const results = Array.from(this.candidates.values())
        .sort((a, b) => b.matchedValues.size - a.matchedValues.size);

      results.forEach(cand => {
        const typeStr = cand.type === 'arg' ? `Arg[${cand.index}]` : "Return";
        const valsStr = Array.from(cand.matchedValues).join(", ");
        console.log(`  [${cand.matchedValues.size}/${this.targetValues.length}] ${cand.className}::${cand.methodName} (${typeStr}) -> Matches: {${valsStr}}`);
      });
      console.log("==================================================\n");
    },

    stop() {
      console.log("[*] Correlation Scanner stopped. Cleaning up...");
      this.classNames.forEach(c => Toolkit.untraceAllMethods(c));
      this.candidates.clear();
    }
  },

  /**
   * Value Correlation Scanner (Heap Scan): Searches for class instances containing target values.
   */
  ValueCorrelationScanner: {
    scan(values: any[], classNames?: string[]) {
      const targets = classNames || Toolkit.getAllClassNames();
      console.log(`\n[🔍 HEAP CORRELATION] Scanning instances of ${targets.length} classes for ${values.length} values...`);

      const results: { instance: Il2Cpp.Object, matchedFields: { name: string, value: any }[], score: number }[] = [];

      targets.forEach(name => {
        const klass = Toolkit.findClass(name);
        if (!klass) return;

        try {
          const instances = Il2Cpp.gc.choose(klass);
          instances.forEach(inst => {
            let matchedFields: { name: string, value: any }[] = [];
            let seenValues = new Set();

            klass.fields.forEach(f => {
              if (f.isStatic) return;
              try {
                const val = inst.field(f.name).value;
                const match = values.find(v => val == v || (val && val.toString() == v.toString()));
                if (match !== undefined) {
                  matchedFields.push({ name: f.name, value: val });
                  seenValues.add(match);
                }
              } catch (e) { }
            });

            if (seenValues.size > 0) {
              results.push({ instance: inst, matchedFields, score: seenValues.size });
            }
          });
        } catch (e) { }
      });

      results.sort((a, b) => b.score - a.score);

      console.log(`\n=== HEAP CORRELATION RESULTS (Top 20) ===`);
      results.slice(0, 20).forEach(r => {
        const fieldsStr = r.matchedFields.map(f => `${f.name}=${f.value}`).join(", ");
        console.log(`  [Score: ${r.score}] ${r.instance.class.fullName} (@ ${r.instance.handle})`);
        console.log(`    -> Fields: ${fieldsStr}`);
      });
      console.log("=========================================\n");
    }
  },

  /**
   * Get all class names from the domain, optionally filtered by assembly name.
   */
  getAllClassNames(assemblyName?: string): string[] {
    const names: string[] = [];
    for (const assembly of Il2Cpp.domain.assemblies) {
      if (assemblyName && !assembly.name.includes(assemblyName)) continue;
      for (const klass of assembly.image.classes) {
        names.push(klass.fullName);
      }
    }
    return names;
  },

  /**
   * Find a class by name across all assemblies.
   */
  findClass(name: string) {
    for (const assembly of Il2Cpp.domain.assemblies) {
      const klass = assembly.image.tryClass(name);
      if (klass) return klass;
    }
    return null;
  },

  /**
   * Game Guardian Style Memory Scanner
   */
  GGScanner: {
    results: [] as NativePointer[],
    search(value: number) {
      this.results = [];
      const ranges = Process.enumerateRanges({ protection: 'rw-', coalesce: true });
      const pattern = value.toString(16).padStart(8, '0').match(/.{1,2}/g)?.reverse().join(' ') || "";

      ranges.forEach(r => {
        try {
          Memory.scanSync(r.base, r.size, pattern).forEach(m => this.results.push(m.address));
        } catch (e) { }
      });
      console.log(`[+] GG: Found ${this.results.length} addresses for value ${value}.`);
    },
    modify(newValue: number) {
      let count = 0;
      this.results.forEach(addr => {
        try {
          addr.writeInt(newValue);
          count++;
        } catch (e) { }
      });
      console.log(`[+] GG: Successfully modified ${count} addresses!`);
    }
  },

  /**
   * Interaction with Unity GameObjects
   */
  Unity: {
    /**
     * Freeze Game Logic using Time.timeScale.
     * Safer than hard pause as it doesn't block the UI thread completely, 
     * but stops animations, physics, and most game logic.
     */
    freeze(state: boolean) {
      try {
        const Time = Toolkit.findClass("UnityEngine.Time");
        if (!Time) return console.log("[-] UnityEngine.Time not found.");
        const set_timeScale = Time.method("set_timeScale");
        set_timeScale.invoke(state ? 0 : 1);
        console.log(`[❄️] Game ${state ? "FROZEN" : "RESUMED"} (Time.timeScale = ${state ? 0 : 1})`);
      } catch (e) {
        console.log(`[!] Error freezing game: ${e}`);
      }
    },

    forceClick(targetName: string) {
      try {
        const GameObject = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class("UnityEngine.GameObject");
        const findMethod = GameObject.method("Find");
        const sendMsgMethod = GameObject.method("SendMessage", 1);

        const go = findMethod.invoke(Il2Cpp.string(targetName)) as Il2Cpp.Object;
        if (!go.isNull()) {
          sendMsgMethod.invoke(go, Il2Cpp.string("OnClick"));
          console.log(`[🚀] SUCCESS: Force clicked GameObject "${targetName}"`);
        } else {
          console.log(`[!] FAILED: GameObject "${targetName}" not found.`);
        }
      } catch (e) {
        console.log(`[!] Error in forceClick: ${e}`);
      }
    },

    trackStatus(targetObjName: string) {
      try {
        const GameObject = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class("UnityEngine.GameObject");
        const setActive = GameObject.method("SetActive");
        const getName = GameObject.method("get_name");

        setActive.implementation = function (state: any) {
          const name = (getName.invoke(this as any) as Il2Cpp.String).content;
          if (name && name.toLowerCase().includes(targetObjName.toLowerCase())) {
            console.log(`\n[🎯 TARGET DETECTED] GameObject: ${name} | State: ${state}`);
            if (state === 0 || state === false) {
              console.log(`[!] Forcing Active (True)!`);
              return setActive.invoke(this as any, 1 as any);
            }
          }
          return setActive.invoke(this as any, state);
        };
        console.log(`[+] GameObject Tracker active for: ${targetObjName}`);
      } catch (e) {
        console.log(`[!] Error in trackStatus: ${e}`);
      }
    },

    replaceUIText(searchString: string, replaceString: string) {
      try {
        // Common UI text methods in Unity
        const targetMethods = ["set_text", "set_Text", "set_content", "SetText"];

        Il2Cpp.domain.assemblies.forEach(assembly => {
          assembly.image.classes.forEach(klass => {
            klass.methods.forEach(method => {
              if (targetMethods.includes(method.name)) {
                const originalImplementation = method.implementation;
                method.implementation = function (text: any) {
                  if (text instanceof Il2Cpp.String) {
                    const content = text.content;
                    if (content && content.toLowerCase().includes(searchString.toLowerCase())) {
                      return method.invoke(this as any, Il2Cpp.string(replaceString));
                    }
                  }
                  return method.invoke(this as any, text);
                };
              }
            });
          });
        });
        console.log(`[*] Text Replacer Ready: "${searchString}" -> "${replaceString}"`);
      } catch (e) {
        console.log(`[-] Error setting up Text Replacer: ${e}`);
      }
    }
  },

  /**
   * Search for classes that contain specific field keywords.
   */
  findDataModel(keywords: string[]) {
    console.log(`[*] Searching for data models containing: ${keywords.join(", ")}`);
    const matches: { className: string, count: number }[] = [];

    Il2Cpp.domain.assemblies.forEach(assembly => {
      assembly.image.classes.forEach(klass => {
        let count = 0;
        klass.fields.forEach(field => {
          keywords.forEach(kw => {
            if (field.name.toLowerCase().includes(kw.toLowerCase())) count++;
          });
        });
        if (count > 0) matches.push({ className: klass.fullName, count });
      });
    });

    matches.sort((a, b) => b.count - a.count).slice(0, 10).forEach(m => {
      console.log(`[Rank] Class ${m.className} matched ${m.count} keywords.`);
    });
  },

  /**
   * Internal storage for custom tip callbacks
   */
  _tipCallbacks: new Map<string, () => void>(),

  /**
   * Get the active LuaScriptMgr instance.
   */
  getLuaScriptMgr(): Il2Cpp.Object {
    const mgrClass = this.findClass("LuaScriptMgr");
    if (!mgrClass) throw new Error("LuaScriptMgr not found");

    const instance = mgrClass.method("get_Instance").invoke() as Il2Cpp.Object;
    if (!instance || instance.handle.isNull()) throw new Error("LuaScriptMgr.Instance is null");

    return instance;
  },

  /**
   * Get the active LuaState instance from the game.
   */
  getLuaState(): Il2Cpp.Object {
    const instance = this.getLuaScriptMgr();
    const luaState = instance.field("lua").value as Il2Cpp.Object;
    if (!luaState || luaState.handle.isNull()) throw new Error("LuaScriptMgr.Instance.lua is null");

    return luaState;
  },

  /**
   * Get a real LuaFunction object from the game by "stealing" an active one.
   */
  getDummyLuaFunction(): Il2Cpp.Object {
    try {
      const mgr = this.getLuaScriptMgr();
      const activeFunc = mgr.field("updateFunc").value as Il2Cpp.Object;

      if (activeFunc && !activeFunc.handle.isNull()) {
        return activeFunc;
      }

      // Fallback: search heap for ANY LuaFunction
      const klass = this.findClass("LuaInterface.LuaFunction");
      if (klass) {
        const instances = Il2Cpp.gc.choose(klass);
        if (instances.length > 0 && instances[0]) {
          console.log(`[+] Stole a LuaFunction from heap @ ${instances[0].handle}`);
          return instances[0] as Il2Cpp.Object;
        }
      }

      throw new Error("No LuaFunction found");
    } catch (e) {
      console.log(`[-] getDummyLuaFunction failed: ${e}`);
      throw e;
    }
  },

  /**
   * Initialize the UISystemTip hook to detect button clicks.
   */
  initTipHook() {
    const self = this;
    const uiSystemTip = this.findClass("UISystemTip");
    if (!uiSystemTip) return;

    // Hook Confirm Button
    const onConfirm = uiSystemTip.method("OnBtnConfirm");
    onConfirm.implementation = function (go: any) {
      try {
        // 'this' should be the UISystemTip instance
        const instance = (this instanceof Il2Cpp.Object) ? this : new Il2Cpp.Object(this as any);

        // Typo in MLBB dump: 'strTitile' (0x1a0)
        const titleField = instance.field("strTitile");
        if (titleField) {
          const title = titleField.value as Il2Cpp.String;
          if (title && !title.handle.isNull() && title.content) {
            const cb = self._tipCallbacks.get(title.content);
            if (cb) {
              console.log(`[🎯] Custom Tip Confirmed: ${title.content}`);
              cb();
              // Remove after successful execution to prevent double trigger
              self._tipCallbacks.delete(title.content);
            }
          }
        }
      } catch (e) {
        console.log(`[!] Hook Error: ${e}`);
      }

      // Call original method safely
      // If 'this' is somehow not an object (thunk issue), we find the instance from GC as fallback
      if (this instanceof Il2Cpp.Object && !(this instanceof Il2Cpp.Class)) {
        return onConfirm.invoke(this, go);
      } else {
        const instances = Il2Cpp.gc.choose(uiSystemTip);
        if (instances.length > 0 && instances[0]) {
          return onConfirm.invoke(instances[0] as Il2Cpp.Object, go);
        }
      }
    };

    console.log("[+] UISystemTip hook initialized.");
  },


  /**
   * Show a system tip using native SystemTipData and UISystemTip.Active().
   * Executed on Main Thread for stability.
   */
  showNativeTip(message: string, title: string, confirmText: string = "OK", cancelText: string = "Cancel") {
    const self = this;
    // UI operations MUST be on Main Thread
    Il2Cpp.mainThread.schedule(() => {
      try {
        console.log(`[*] [MainThread] Triggering native tip: ${title}`);

        const dataClass = self.findClass("SystemTipData");
        const uiClass = self.findClass("UISystemTip");
        const enumClass = self.findClass("eSystemTipType");
        if (!dataClass || !uiClass || !enumClass) return;

        // 1. Create and populate SystemTipData
        const data = dataClass.alloc();
        data.method(".ctor").invoke();

        data.field("strTip").value = Il2Cpp.string(message);
        data.field("strCmd").value = Il2Cpp.string(confirmText);
        data.field("strCancel").value = Il2Cpp.string(cancelText);

        const enumValue = enumClass.field("SimpleTxt_Confirm").value;
        data.field("type").value = enumValue;

        // 2. Get UISystemTip instance
        let uiInstance = uiClass.method("get_Instance").invoke() as Il2Cpp.Object;
        if (!uiInstance || uiInstance.handle.isNull()) {
          // Backup: check static _install field
          uiInstance = uiClass.field("_install").value as Il2Cpp.Object;
        }

        if (!uiInstance || uiInstance.handle.isNull()) {
          console.log("[-] UISystemTip instance not found (even in _install).");
          return;
        }

        // 3. Force update title and data
        const titleField = uiInstance.field("strTitile");
        if (titleField) titleField.value = Il2Cpp.string(title);

        const dataField = uiInstance.field("data");
        if (dataField) dataField.value = data;

        // 4. Activate UI
        uiInstance.method("Active").invoke(data);

        console.log("[+] Native tip displayed on Main Thread.");
      } catch (e) {
        console.log(`[-] Main Thread showNativeTip failed: ${e}`);
      }
    });
  },

  /**
   * Call a method in any class with custom arguments.
   * Handles both static and instance methods.
   */
  callMethod(className: string, methodName: string, args: any[], instanceHandle?: NativePointer): any {
    const klass = this.findClass(className);
    if (!klass) {
      console.log(`[-] Class '${className}' not found.`);
      return;
    }

    const methods = klass.methods.filter(m => m.name === methodName);
    if (methods.length === 0) {
      console.log(`[-] Method '${methodName}' not found in class '${className}'.`);
      return;
    }

    // Try to find the method with matching parameter count
    let method = methods.find(m => m.parameterCount === args.length);
    if (!method) {
      console.log(`[!] Warning: No overload of '${methodName}' with ${args.length} parameters found. Using first available.`);
      method = methods[0];
    }

    if (!method) return;

    const isStatic = method.isStatic;

    try {
      // Convert arguments to Il2Cpp-compatible types if necessary
      const processedArgs = args.map(arg => {
        if (typeof arg === "string") return Il2Cpp.string(arg);
        // Objects and numbers are usually handled correctly by invoke()
        return arg;
      });

      if (isStatic) {
        return method.invoke(...processedArgs);
      } else {
        let instance: Il2Cpp.Object | undefined;
        if (instanceHandle) {
          instance = new Il2Cpp.Object(instanceHandle);
        } else {
          const instances = Il2Cpp.gc.choose(klass);
          if (instances.length === 0) {
            console.log(`[-] No instances of '${className}' found in memory, and method is not static.`);
            return;
          }
          instance = instances[0];
          console.log(`[*] Using first found instance of ${className} @ ${instance!.handle}`);
        }

        if (instance) {
          return method.invoke(instance, ...processedArgs);
        }
      }
    } catch (e) {
      console.log(`[-] Error calling ${className}::${methodName}: ${e}`);
    }
  }
};
