module Path from "node:path";
module FS from "node:fs";

import { FileStream } from "../src/FileStream.js";

export async main() {

    var stream = new FileStream,
        buffer = new Buffer(">hello world", "utf8");
    
    await stream.open(Path.resolve(__dirname, "file-stream-out.txt"), "w");
    
    for (var i = 0; i < 10; ++i)
        await stream.write(buffer);
    
    var fd = stream.file;
    
    await stream.close();
    
    // Generates EBADF error
    var err = FS.writeSync(fd, buffer);
}
