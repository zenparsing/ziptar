export class BufferReader {

    constructor(buffer) {
    
        this.buffer = buffer;
        this.position = 0;
    }
    
    read(length, target = new Buffer(length), offset = 0) {
    
        if (length === 0)
            return null;
        
        this.buffer.copy(target, offset, this._advance(length), this.position);
    }
    
    readString(byteLength, encoding = "utf8") {
    
        if (byteLength === 0)
            return "";
        
        return this.buffer.toString(encoding, this._advance(byteLength), this.position);
    }
    
    readUInt8(noAssert) {
    
        return this.buffer.readUInt8(this._advance(1), noAssert);
    }
    
    readUInt16LE(noAssert) {
    
        return this.buffer.readUInt16LE(this._advance(2), noAssert);
    }
    
    readUInt16BE(noAssert) {
    
        return this.buffer.readUInt16BE(this._advance(2), noAssert);
    }
    
    readUInt32LE(noAssert) {
    
        return this.buffer.readUInt32LE(this._advance(4), noAssert);
    }
    
    readUInt32BE(noAssert) {
    
        return this.buffer.readUInt32BE(this._advance(4), noAssert);
    }
    
    readInt8(noAssert) {
    
        return this.buffer.readInt8(this._advance(1), noAssert);
    }
    
    readInt16LE(noAssert) {
    
        return this.buffer.readInt16LE(this._advance(2), noAssert);
    }
    
    readInt16BE(noAssert) {
    
        return this.buffer.readInt16BE(this._advance(2), noAssert);
    }
    
    readInt32LE(noAssert) {
    
        return this.buffer.readInt32LE(this._advance(4), noAssert);
    }
    
    readInt32BE(noAssert) {
    
        return this.buffer.readInt32BE(this._advance(4), noAssert);
    }
    
    readFloatLE(noAssert) {
    
        return this.buffer.readFloatLE(this._advance(4), noAssert);
    }
    
    readFloatBE(noAssert) {
    
        return this.buffer.readFloatBE(this._advance(4), noAssert);
    }
    
    readDoubleLE(noAssert) {
    
        return this.buffer.readDoubleLE(this._advance(8), noAssert);
    }
    
    readDoubleBE(noAssert) {
    
        return this.buffer.readDoubleBE(this._advance(8), noAssert);
    }
    
    _advance(count) {
    
        var p = this.position;
        this.position += count;
        return p;
    }
}