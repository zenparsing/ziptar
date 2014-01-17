import { normalizePath } from "Utilities.js";
import { TarExtended } from "TarExtended.js";

var NAME = 100,
    MODE = 8,
    OWNER = 8,
    GROUP = 8,
    SIZE = 12,
    MODIFIED = 12,
    CHECKSUM = 8,
    TYPE = 1,
    LINK_PATH = 100,
    MAGIC = 6,
    VERSION = 2,
    OWNER_NAME = 32,
    GROUP_NAME = 32,
    DEV_MAJOR = 8,
    DEV_MINOR = 8,
    PREFIX = 155;

var CHECKSUM_START = 148,
    CHECKSUM_END = CHECKSUM_START + CHECKSUM,
    HEADER_SIZE = 512,
    SPACE_VAL = " ".charCodeAt(0),
    SLASH_VAL = "/".charCodeAt(0);

var headerTypes = {

    "0": "file",
    "1": "link",
    "2": "symlink",
    "3": "character-device",
    "4": "block-device",
    "5": "directory",
    "6": "fifo",
    "7": "contiguous-file",
    "g": "global-attributes",
    "x": "file-attributes",
    "A": "solaris-acl",
    "D": "gnu-directory",
    "I": "inode",
    "K": "long-link-name",
    "L": "long-path-name",
    "M": "continuation-file",
    "N": "old-long-path-name",
    "S": "sparse-file",
    "V": "tape-volumn-header",
    "X": "old-attributes"
};

Object.keys(headerTypes).forEach(k => { headerTypes[headerTypes[k]] = k });

class FieldWriter {

    constructor(buffer) {
    
        this.buffer = buffer;
        this.position = 0;
    }
    
    skip(length) {
    
        this.position += length;
    }
    
    zero(length) {
    
        if (length === void 0)
            length = this.buffer.length - this.position;
        
        for (var i = 0; i < length; ++i)
            this.buffer[this.position++] = 0;
    }
    
    text(value, length) {
    
        var byteLength = Buffer.byteLength(value),
            count = Math.min(length, byteLength);
        
        this.buffer.write(value, this.position, count, "utf8");
        this.position += count;
        
        // Fill with NULLs
        this.zero(length - count);
    }
    
    number(value, length) {
    
        // Field numbers should be integers
        value = Math.floor(value);
        
        // Numbers greater that maximum or less than zero are binary encoded
        if (value < 0 || value > Math.pow(8, length - 1) - 1)
            return this.binaryNumber(value, length);
        
        var n = value.toString(8),
            count = length - 1,
            space = false;
        
        while (n.length < count) {
        
            // Add a space after the number, and pad remaining
            // characters with "0"
            if (!space) { n = n + " "; space = true; }
            else n = "0" + n;
        }
        
        // Write padded octal string
        this.buffer.write(n, this.position, count, "utf8");
        
        // NULL terminate
        this.buffer[this.position + count] = 0;
        
        this.position += length;
    }
    
    date(value, length) {
    
        return this.number(value.getTime() / 1000, length);
    }
    
    binaryNumber(value, length) {
    
        var b = this.buffer.slice(this.position, this.position += length),
            neg = false,
            x;
        
        if (value < 0) {
        
            // For negative numbers, we will encode the 2's complement by
            // subtracting one from the absolute value and then encoding the 
            // 1's complement of that number. 
            
            neg = true;
            value = (-1 * value) - 1;
        }
        
        // Writing from the last position to first...
        for (var i = length - 1; i > 0; --i) {
        
            x = value % 256;
            
            // If negative write the 1's complement
            b[i] = neg ? (0xFF - x) : x;
            
            value = (value - x) / 256;
        }
        
        // Set high bit, regardless of sign
        b[0] = neg ? 0xFF : 0x80;
    }
}

class FieldReader {

    constructor(buffer) {
    
        this.buffer = buffer;
        this.position = 0;
    }
    
    next(length) {
    
        var p = this.position;
        return this.buffer.slice(p, this.position += length);
    }
    
    text(length) {
    
        return this.next(length).toString("utf8").replace(/\0\S*$/, "").trim();
    }
    
    number(length) {
    
        // Binary numbers have the first bit set
        if (this.buffer[this.position] & 0x80)
            return this.binaryNumber(length);
        
        return parseInt(this.text(length), 8);
    }
    
    date(length) {
    
        return new Date(this.number(length) * 1000);
    }
    
    binaryNumber(length) {
    
        var b = this.next(length),
            neg = false,
            pos = 0,
            val = 0,
            x;
    
        // Binary numbers should always have highest bit set
        if (b[0] == 0xFF) neg = true;
        else if (b[0] != 0x80) return NaN;
    
        // Reading from last position to first...
        for (var i = length - 1; i > 0; --i) {
        
            x = b[i];
            
            // If negative, read the 1's complement
            if (neg)
                x = 0xFF - x;
            
            val += x * Math.pow(256, pos++);
        }
        
        // Find 2's complement by adding 1 and negating
        if (neg)
            val = -1 * (val + 1);
            
        return val;
    }
}

class Checksum {

    static compute(data) {
    
        var signed = 0, unsigned = 0, i = 0;
    
        for (; i < CHECKSUM_START; ++i)
            sum(data[i]);
    
        for (; i < CHECKSUM_END; ++i)
            sum(SPACE_VAL);
    
        for (; i < HEADER_SIZE; ++i)
            sum(data[i]);
    
        return { signed, unsigned };
    
        function sum(val) {
    
            signed += val >= 0x80 ? (val - 256) : val;
            unsigned += val;
        }
    }
    
    static match(data, value) {
    
        var sum = this.compute(data);
        return sum.signed == value || sum.unsigned == value;
    }
}

function splitPath(path) {

    var b = new Buffer(path),
        name = path,
        prefix = "",
        unicode = b.length !== path.length,
        overflow = unicode;
    
    // If name cannot fit completely within name field...
    if (b.length > NAME) {
    
        overflow = true;
    
        // If name is small enough to be split...
        if (b.length - 1 <= NAME + PREFIX) {
        
            // Scan for a "/" from the 101th byte from the end to the 
            // next to last byte
            for (var i = b.length - (NAME + 1); i < b.length - 1; ++i) {
        
                if (b[i] == SLASH_VAL) {
        
                    prefix = b.toString("utf8", 0, i);
                    name = b.toString("utf8", i + 1, b.length);
                    overflow = unicode;
                    break;
                }
            }
        }
    }
        
    return { name, prefix, overflow };
}

class Overflow {

    constructor(header) {
    
        this.header = header;
        this.fields = {};
    }

    name(field) {
    
        this.test(field, v => splitPath(v).overflow);
    }
    
    text(field, length) {
    
        this.test(field, v => {
        
            var bytes = (new Buffer(v)).length;
            return bytes > v.length || bytes > length;
        });
    }
    
    number(field, length) {
    
        this.test(field, v => {
        
            if (v && v.getTime) v = v.getTime() / 1000;
            return v < 0 || v > Math.pow(8, length - 1) - 1
        });
    }
    
    test(field, pred) {
    
        var v = this.header[field];
        
        if (pred(v))
            this.fields[field] = v;
    }
}

export class TarHeader {

    constructor(name) {
    
        this.name = normalizePath(name || "");
        this.mode = 0;
        this.userID = 0;
        this.groupID = 0;
        this.size = 0;
        this.lastModified = new Date();
        this.type = "file";
        this.linkPath = "";
        this.userName = "";
        this.groupName = "";
        this.deviceMajor = 0;
        this.deviceMinor = 0;
    }
    
    write(buffer) {
    
        if (buffer === void 0)
            buffer = new Buffer(HEADER_SIZE);
        else if (buffer.length < HEADER_SIZE)
            throw new Error("Insufficient buffer");
        
        var w = new FieldWriter(buffer);
        var path = splitPath(normalizePath(this.name));
        
        w.text(path.name, NAME);
        w.number(this.mode & 0x1FF, MODE);
        w.number(this.userID, OWNER);
        w.number(this.groupID, GROUP);
        w.number(this.size, SIZE);
        w.date(this.lastModified, MODIFIED);
        w.skip(CHECKSUM);
        w.text(headerTypes[this.type] || "0", TYPE);
        w.text(this.linkPath, LINK_PATH);
        w.text("ustar ", MAGIC);
        w.text("00", VERSION);
        w.text(this.userName, OWNER_NAME);
        w.text(this.groupName, GROUP_NAME);
        w.number(this.deviceMajor, DEV_MAJOR);
        w.number(this.deviceMinor, DEV_MINOR);
        w.text(path.prefix, PREFIX);
        w.zero();
        
        // Calculate and store checksum after everything else
        // has been written
        w.position = CHECKSUM_START;
        w.number(Checksum.compute(buffer).signed, CHECKSUM);
        
        return buffer;
    }
    
    getOverflow() {
    
        var over = new Overflow(this);
        
        over.name("name");
        over.number("size", SIZE);
        over.number("lastModified", MODIFIED);
        over.text("linkPath", LINK_PATH);
        over.text("userName", OWNER_NAME);
        over.text("groupName", GROUP_NAME);
        
        return over.fields;
    }
    
    static LENGTH() { return HEADER_SIZE }
    
    static fromEntry(entry) {
    
        var h = new this();
        
        Object.keys(h).forEach(k => entry[k] !== void 0 && (h[k] = entry[k]));
        
        return h;
    }
    
    static fromBuffer(buffer) {
    
        if (buffer === void 0)
            buffer = new Buffer(HEADER_SIZE);
        else if (buffer.length < HEADER_SIZE)
            throw new Error("Invalid buffer size");
        
        var r = new FieldReader(buffer);
        var h = new this;
        
        h.name = r.text(NAME);
        h.mode = r.number(MODE);
        h.userID = r.number(OWNER);
        h.groupID = r.number(GROUP);
        h.size = r.number(SIZE);
        h.lastModified = r.date(MODIFIED);
        
        if (!Checksum.match(buffer, r.number(CHECKSUM)))
            throw new Error("Invalid checksum");
        
        h.type = headerTypes[r.text(TYPE)] || "file";
        h.linkPath = r.text(LINK_PATH);
        
        // Stop here if magic "ustar" field is not set
        if (r.text(MAGIC) !== "ustar")
            return h;
        
        r.next(VERSION);
        
        h.userName = r.text(OWNER_NAME);
        h.groupName = r.text(GROUP_NAME);
        h.deviceMajor = r.number(DEV_MAJOR);
        h.deviceMinor = r.number(DEV_MINOR);
        
        // TODO: node-tar attempts to parse out file access time and file creation time
        // attributes from the 130th char of this field.  Should we?
        
        var prefix = r.text(PREFIX);
        
        if (prefix)
            h.name = prefix + "/" + h.name;
        
        h.name = normalizePath(h.name);
        
        return h;
    }
}

