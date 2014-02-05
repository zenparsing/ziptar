module Path from "node:path";

import { AsyncFS } from "package:zen-bits";
import { ZipReader, ZipWriter } from "ZipFile.js";
import { createDirectory } from "Utilities.js";
import { FileStream } from "FileStream.js";
import { Pipe } from "Pipe.js";

export async zip(list, dest) {

    if (typeof list === "string")
        list = [list];
    
    var z = await ZipWriter.open(dest);
    
    for (var i = 0; i < list.length; ++i)
        await add(Path.resolve(list[i]), "");
    
    await z.close();
    
    async add(path, dir) {
    
        var filename = Path.basename(path),
            stat = await AsyncFS.stat(path),
            isDir = stat.isDirectory();
        
        if (!isDir && !stat.isFile())
            throw new Error("Invalid path");
        
        var entry = z.createEntry(dir + filename + (isDir ? "/" : ""));
        
        entry.lastModified = stat.mtime;
        
        var outStream = await entry.open();
        
        if (entry.isDirectory) {
        
            await outStream.end();
            
            var list = (await AsyncFS.readdir(path))
                .filter(item => item !== ".." && item !== ".")
                .map(item => Path.join(path, item));
            
            for (var i = 0; i < list.length; ++i)
                await add(list[i], entry.name);
        
        } else {
            
            var pipe = new Pipe(await FileStream.open(path, "r"));
            pipe.filename = path;
            pipe.connect(outStream, true);
            await pipe.start();
        }
        
    }
}

export async unzip(source, dest) {

    dest = Path.resolve(dest);
    
    var z = await ZipReader.open(source),
        entry,
        outPath,
        inStream,
        outStream,
        pipe;
    
    // Create the destination directory
    await createDirectory(dest);
    
    for (var i = 0; i < z.entries.length; ++i) {
    
        entry = z.entries[i];
        outPath = Path.join(dest, entry.name);
        
        if (entry.isDirectory) {
        
            await createDirectory(outPath, true);
            
        } else {
        
            // Create intermediate directories
            await createDirectory(Path.dirname(outPath), true);
        
            // Open streams and pipe them together
            inStream = await entry.open();
            outStream = await FileStream.open(outPath, "w");
        
            pipe = new Pipe(inStream);
            pipe.connect(outStream, true);
        
            // Start data flow
            await pipe.start();
        }
    }
    
    await z.close();
}