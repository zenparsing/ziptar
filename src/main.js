module Path from "node:path";
module AsyncFS from "AsyncFS.js";

import { ZipReader, ZipWriter } from "ZipFile.js";
import { TarReader, TarWriter } from "TarFile.js";
import { createDirectory } from "Utilities.js";
import { FileStream } from "FileStream.js";
import { Pipe } from "Pipe.js";

export async tar(list, dest, zip) {

    return createArchive(await TarWriter.open(dest, zip), list);
}

export async untar(source, dest, unzip) {

    return extractArchive(await TarReader.open(source, unzip), dest);
}

export async zip(list, dest) {

    return createArchive(await ZipWriter.open(dest), list);
}

export async unzip(source, dest) {

    return extractArchive(await ZipReader.open(source), dest);
}

async createArchive(archive, list) {

    if (typeof list === "string")
        list = [list];
    
    for (var i = 0; i < list.length; ++i)
        await add(Path.resolve(list[i]), "");
    
    await archive.close();
    
    async add(path, dir) {
    
        var filename = Path.basename(path),
            stat = await AsyncFS.stat(path),
            isDir = stat.isDirectory();
        
        if (!isDir && !stat.isFile())
            throw new Error("Invalid path");
        
        var entry = archive.createEntry(dir + filename + (isDir ? "/" : ""));
        
        entry.lastModified = stat.mtime;
        
        var outStream = await entry.open();
        
        if (entry.isDirectory) {
        
            await outStream.end();
            
            var list = (await AsyncFS.readdir(path))
                .filter(item => item !== ".." && item !== ".")
                .map(item => Path.join(path, item));
            
            for (var i = 0; i < list.length; ++i)
                await add(list[i], entry.name);
        
        } else if (entry.isFile) {
            
            var pipe = new Pipe(await FileStream.open(path, "r"));
            pipe.filename = path;
            pipe.connect(outStream, true);
            await pipe.start();
            
        } else {
        
            entry.close();
        }
        
    }
}

async extractArchive(archive, dest) {

    dest = Path.resolve(dest);
    
    var entry,
        outPath,
        inStream,
        outStream,
        pipe;
    
    // Create the destination directory
    await createDirectory(dest);
    
    while (entry = await archive.nextEntry()) {
    
        outPath = Path.join(dest, entry.name);
        
        if (entry.isDirectory) {
        
            await createDirectory(outPath, true);
            
        } else if (entry.isFile) {
        
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
    
    await archive.close();
}