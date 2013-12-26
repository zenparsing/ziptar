module Path from "node:path";

import { FileStream } from "../src/FileStream.js";

export async main() {

    var stream = new FileStream,
        buffer = new Buffer(">hello world", "utf8");
    
    await stream.open(Path.resolve(__dirname, "stream-out.txt"), "w");
    
    var list = [];
    
    for (var i = 0; i < 10; ++i)
        list.push(stream.write(buffer));
    
    await Promise.all(list);
    
    await stream.close();
    
    await stream.write(buffer);
}
