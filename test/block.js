module Path from "node:path";

import { CopyStream } from "../src/CopyStream.js";
import { FileStream } from "../src/FileStream.js";
import { Pipe } from "../src/Pipe.js";

export async main() {

    var inStream = await FileStream.open(Path.join(__dirname, "../_ref/infozip-spec.txt"), "r");
    var p1 = new Pipe(inStream, { bufferSize: 6 * 1024, maxBuffers: 2 });
    var block = new CopyStream;
    var p2 = new Pipe(block, { bufferSize: 512 });
    
    p1.connect(block, true);
    
    p2.connect({
    
        async write(buffer, start, length) {
        
            console.log("writing", length - start);
        },
        
        async end() {
        
            console.log("end");
        }
        
    }, true);
    
    await Promise.all([
        p1.start(), 
        p2.start()
    ]);
}