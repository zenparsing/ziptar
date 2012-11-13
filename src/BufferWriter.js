export class BufferWriter {

    constructor(buffer) {
    
        this.buffer = buffer;
        this.position = 0;
    }
    
    write(data, start, end) {
    
        this.position += data.copy(this.buffer, this.position, start, end);
    }
    
    writeString(string, encoding) {
    
        this.position += this.buffer.write(string, this.position, void 0, encoding);
    }
    
    writeUInt8(value, noAssert) {
    
        this.buffer.writeUInt8(value, this.position, noAssert);
        this.position += 1;
    }
    
    writeUInt16LE(value, noAssert) {
    
        this.buffer.writeUInt16LE(value, this.position, noAssert);
        this.position += 2;
    }
    
    writeUInt16BE(value, noAssert) {
    
        this.buffer.writeUInt16BE(value, this.position, noAssert);
        this.position += 2;
    }
    
    writeUInt32LE(value, noAssert) {
    
        this.buffer.writeUInt32LE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeUInt32BE(value, noAssert) {
    
        this.buffer.writeUInt32BE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeInt8(value, noAssert) {
    
        this.buffer.writeInt8(value, this.position, noAssert);
        this.position += 1;
    }
    
    writeInt16LE(value, noAssert) {
    
        this.buffer.writeInt16LE(value, this.position, noAssert);
        this.position += 2;
    }
    
    writeInt16BE(value, noAssert) {
    
        this.buffer.writeInt16BE(value, this.position, noAssert);
        this.position += 2;
    }
    
    writeInt32LE(value, noAssert) {
    
        this.buffer.writeInt32LE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeInt32BE(value, noAssert) {
    
        this.buffer.writeInt32BE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeFloatLE(value, noAssert) {
    
        this.buffer.writeFloatLE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeFloatBE(value, noAssert) {
    
        this.buffer.writeFloatBE(value, this.position, noAssert);
        this.position += 4;
    }
    
    writeDoubleLE(value, noAssert) {
    
        this.buffer.writeDoubleLE(value, this.position, noAssert);
        this.position += 8;
    }
    
    writeDoubleBE(value, noAssert) {
    
        this.buffer.writeDoubleBE(value, this.position, noAssert);
        this.position += 8;
    }
}