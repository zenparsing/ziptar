module Path from "node:path";

import { AsyncFS } from "package:zen-bits";
import { FileStream } from "FileStream.js";
import { TarHeader } from "TarHeader.js";

var RECORD_SIZE = 512;
var BUFFER_SIZE = 32 * RECORD_SIZE;

class TarReader {

    constructor(stream) {
    
        this.stream = stream;
    }
}

export class TarFile {

    static async pack(files, archive) {
    
    }
    
    static async unpack(path, predicate) {
    
        path = Path.resolve(path);
        
        var inStream = new FileStream,
            buffer = new Buffer(BUFFER_SIZE),
            record;
        
        await inStream.open(path);
        
        while (record = nextRecord()) {
        
            header = TarHeader.fromBuffer(record);
            
            switch (header.type) {
            
                case "link": break;
                case "symlink": break;
                case "character-device": break;
                case "block-device": break;
                case "directory": break;
                case "fifo": break;
                case "contiguous-file": break;
                case "global-attributes": break;
                case "file-attributes": break;
                case "solaris-acl": break;
                case "gnu-directory": break;
                case "inode": break;
                case "long-link-name": break;
                case "long-path-name": break;
                case "continuation-file": break;
                case "old-long-path-name": break;
                case "sparse-file": break;
                case "tape-volumn-header": break;
                case "old-attributes": break;
                default: break;
                
            }
        }
        
        async nextRecord() {
        
            if (buffer.length > RECORD_SIZE) {
            
                buffer = buffer.slice(RECORD_SIZE);
            
            } else {
            
                var count = await inStream.read(buffer);
                if (count === 0) return null;
            }
            
            return buffer.slice(0, RECORD_SIZE);
        }
    }
}
