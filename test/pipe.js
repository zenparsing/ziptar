import { Pipe } from "../src/Pipe.js";
import { FileStream } from "../src/FileStream.js";
import { GZipStream, GUnzipStream } from "../src/Compression.js";

module Path from "node:path";

export async main() {

    var input = await FileStream.open(Path.resolve(__dirname, "pipe.js"), "r");
    var output = await FileStream.open(Path.resolve(__dirname, "_pipeout.js.gz"), "w");
    
    var pipe = new Pipe(input, { 
    
        bufferSize: 8 * 1024,
        minBuffers: 1,
        maxBuffers: 2
    });
    
    var gzip = new GZipStream;
    
    var pipe2 = new Pipe(gzip, {
    
        bufferSize: 16 * 1024,
        minBuffers: 1,
        maxBuffers: 2
    });
    
    pipe.connect(gzip, true);
    pipe2.connect(output, true);
    
    await (pipe.start(), pipe2.start());
    
    //pipe.connect(await FileStream.open(Path.resolve(__dirname, "_pipeout2.js"), "w"), true);

    //await pipe.start();
    
    //await input.close();
    //await output.close();
}