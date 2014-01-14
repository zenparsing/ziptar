import { runTests } from "package:moon-unit";
import { TarExtended } from "../../src/TarExtended.js";

export async main() {

    await runTests({
    
        "TarExtended"(test) {
        
            var fields = { 
            
                foo: "bar", 
                atime: new Date(123456), 
                size: 123.456
            };
            
            var buffer = TarExtended.write(fields); 
            
            test._("Output buffer is the correct size").equals(buffer.length, 44);
            
            var lines = buffer.toString().split(/\n/);
            
            test._("Output has the correct number of lines").equals(lines.length, 4);
            test._("Output line 1").equals(lines[0], "11 foo=bar");
            test._("Output line 2").equals(lines[1], "17 atime=123.456");
            test._("Output line 2").equals(lines[2], "16 size=123.456");
            test._("Output line 3").equals(lines[3], "");
            
            var fields2 = TarExtended.read(buffer);
            
            test._("Buffer is correctly parsed").equals(fields, fields2);
            
        }
    });
}