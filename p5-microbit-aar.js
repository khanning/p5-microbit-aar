/* jshint esversion: 8 */

const M1 = 1;
const M2 = 2
const BOTH = 0;

const THIS_WAY = 0;
const THAT_WAY = 1;
const REVERSE = 2;

class MicroBitAAR {

  constructor() {
    this.callbackListeners = {
      'connected': {},
      'disconnected': {}
    }
    this.SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    this.TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
    this.RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
    this.connected = false;
    this.validMotors = [M1, M2, BOTH];
    this.validDirs = [THIS_WAY, THAT_WAY, REVERSE];
    this.sendQueue = [];
    this.sending = false;
  }

  on(event, callback) {
    this.callbackListeners[event][callback] = callback;
  }

  removeListener(event, callback) {
    delete this.callbackListeners[event][callback];
  }

  async search() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{
        services: [this.SERVICE_UUID]
      }]
    });
    if (!device) return;
    this.startBLE(device);
  }

  handleDisconnect() {
    this.connected = false;
    Object.keys(this.callbackListeners.disconnected).forEach(k => {
      this.callbackListeners.disconnected[k]();
    });
  }

  handleInput() {
    //Not receiving input from micro:bit yet
  }

  startMotor(m) {
    let motor = parseInt(m);
    if (!this.motorIsValid(motor)) {
      console.log(`Error: motor ${m} is not valid`);
      return;
    }
    this.send([0xF1, motor]);
  }

  stopMotor(m) {
    let motor = parseInt(m);
    if (!this.motorIsValid(motor)) {
      console.log(`Error: motor ${m} is not valid`);
      return;
    }
    this.send([0xF0, motor]);
  }

  setMotorPower(m, p) {
    let motor = parseInt(m);
    if (!this.motorIsValid(motor)) {
      console.log(`Error: motor ${m} is not valid`);
      return;
    }
    let power = parseInt(p);
    if (isNaN(power)) {
      console.log(`Error: power ${p} is not valid`);
    }
    power = Math.min(Math.max(power, 0), 100);
    this.send([0xF2, motor, power]);
  }

  setMotorDirection(m, d) {
    let motor = parseInt(m);
    if (!this.motorIsValid(motor)) {
      console.log(`Error: motor ${m} is not valid`);
      return;
    }
    let direction = parseInt(d);
    if (isNaN(direction) || this.validDirs.indexOf(direction) < 0) {
      console.log(`Error: direction ${d} is not valid`);
    }
    this.send([0xF3, motor, direction]);
  }

  motorIsValid(m) {
    return !isNaN(m) && this.validMotors.indexOf(m) >= 0;
  }

  send (data) {
    if (!this.connected || !this.txChar) {
      console.log("Error: micro:bit not connected")
    }
    if (this.sending) {
      this.sendQueue.push(data);
      return;
    }
    this.sending = true;
    this.txChar.writeValue(new Uint8Array(data));
    setTimeout(() => {
      this.sending = false;
      if (this.sendQueue.length > 0) {
        this.send(this.sendQueue.shift());
      }
    }, 50);
  }

  async startBLE(device) {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(this.SERVICE_UUID);
    if (!service) return;
    this.uartService = service;
    this.txChar = await this.uartService.getCharacteristic(this.TX_UUID)
    if (!this.txChar) return;
    this.rxChar = await this.uartService.getCharacteristic(this.RX_UUID)
    if (!this.rxChar) return;
    await this.rxChar.startNotifications();
    this.rxChar.addEventListener('characteristicvaluechanged', this.handleInput.bind(this));
    this.bleDevice = device;
    this.bleDevice.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));
    this.connected = true;
    Object.keys(this.callbackListeners.connected).forEach(k => {
      this.callbackListeners.connected[k]();
    });
  }
}
