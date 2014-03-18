module Path from "node:path";

module AFS from "package:afs";
import { File, Directory } from "package:afs";
import { Pipe } from "package:streamware";

import { ZipReader, ZipWriter } from "ZipFile.js";
import { TarReader, TarWriter } from "TarFile.js";

function getArchiveExtension(path) {

    var match = /(\.tar)?\.[^\.]+$/i.exec(Path.basename(path));
    return match ? match[0].toLowerCase() : "";
}

export async function tar(list, dest, options) {

    return createArchive(await TarWriter.open(dest, options), list);
}

export async function untar(source, dest, options) {

    return extractArchive(await TarReader.open(source, options), dest);
}

export async function zip(list, dest, options) {

    return createArchive(await ZipWriter.open(dest, options), list);
}

export async function unzip(source, dest, options) {

    return extractArchive(await ZipReader.open(source, options), dest);
}

export async function extract(source, dest) {

    source = Path.resolve(source);
    dest = dest ? Path.resolve(dest) : Path.dirname(source);
    
    var reader;
    
    switch (getArchiveExtension(source)) {
    
        case ".tar.gz":
        case ".tgz":
            reader = await TarReader.open(source, { unzip: true });
            break;
        
        case ".tar":
            reader = await TarReader.open(source, { unzip: false });
            break;
        
        case ".zip":
            reader = await ZipReader.open(source);
            break;
        
        default:
            throw new Error("Unknown file type");
    }
    
    return extractArchive(reader, dest);
}

async function createArchive(archive, list) {

    if (typeof list === "string")
        list = [list];
    
    for (var i = 0; i < list.length; ++i)
        await add(Path.resolve(list[i]), "");
    
    await archive.close();
    
    async function add(path, dir) {
    
        var filename = Path.basename(path),
            stat = await AFS.stat(path),
            isDir = stat.isDirectory();
        
        if (!isDir && !stat.isFile())
            throw new Error("Invalid path");
        
        var entry = archive.createEntry(dir + filename + (isDir ? "/" : ""));
        
        entry.lastModified = stat.mtime;
        
        if (entry.isFile)
            entry.size = stat.size;
        
        var outStream = await entry.open();
        
        if (entry.isDirectory) {
        
            await outStream.end();
            
            var list = (await Directory.list(path))
                .filter(item => item !== ".." && item !== ".")
                .map(item => Path.join(path, item));
            
            for (var i = 0; i < list.length; ++i)
                await add(list[i], entry.name);
        
        } else if (entry.isFile) {
            
            var pipe = new Pipe(await File.openRead(path));
            pipe.connect(outStream, true);
            await pipe.start();
            
        } else {
        
            await entry.close();
        }
        
    }
}

async function extractArchive(archive, dest) {

    var entry,
        outPath,
        inStream,
        outStream,
        pipe;
    
    // Create the destination directory
    await Directory.create(dest);
    
    while (entry = await archive.nextEntry()) {
    
        outPath = Path.join(dest, entry.name);
        
        if (entry.isDirectory) {
        
            await Directory.create(outPath, true);
            
        } else if (entry.isFile) {
        
            // Create intermediate directories
            await Directory.create(Path.dirname(outPath), true);
        
            // Open streams and pipe them together
            inStream = await entry.open();
            outStream = await File.openWrite(outPath);
        
            pipe = new Pipe(inStream);
            pipe.connect(outStream, true);
        
            // Start data flow
            await pipe.start();
            
            // Set the last modified time for the file
            await AFS.utimes(outPath, entry.lastModified, entry.lastModified);
        }
    }
    
    await archive.close();
}