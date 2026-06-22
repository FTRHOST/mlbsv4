import "frida-il2cpp-bridge";

function main() {
  // Set module name specifically for MLBB
  Il2Cpp.$config.moduleName = "liblogic.so";

  Il2Cpp.perform(() => {
    console.log("[*] IL2CPP initialized. Searching for SystemData class...");
    const Assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const SystemData = Assembly.tryClass("SystemData");

    if (!SystemData || SystemData.handle.isNull()) {
      console.log("[-] Class SystemData not found!");
      return;
    }

    console.log("\n==================================================");
    console.log(`Class: ${SystemData.fullName}`);
    console.log("==================================================");

    console.log("\n--- FIELDS ---");
    SystemData.fields.forEach(f => {
      try {
        console.log(`- ${f.modifier} ${f.isStatic ? "static " : ""}${f.type.name} ${f.name} (Offset: 0x${f.offset.toString(16)})`);
      } catch (err) {
        console.log(`- Error reading field: ${f.name}`);
      }
    });

    console.log("\n--- METHODS ---");
    SystemData.methods.forEach(m => {
      try {
        console.log(`- ${m.modifier} ${m.isStatic ? "static " : ""}${m.returnType.name} ${m.name}(${m.parameters.map(p => p.type.name + " " + p.name).join(", ")}) [Addr: ${m.virtualAddress}]`);
      } catch (err) {
        console.log(`- Error reading method: ${m.name}`);
      }
    });
    console.log("==================================================\n");
  });
}

setImmediate(main);
