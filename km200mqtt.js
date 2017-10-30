#!/usr/bin/env node
var request = require('request');
var async = require('async');
var MCrypt = require('mcrypt').MCrypt;
var buffertrim = require('buffertrim');
var mqtt = require('mqtt');
require('require-yaml');

var config = require('./config.yml');
console.log('Starting km200 to mqtt');
console.log(__dirname + '/config.yml');
console.log(config);

var key = new Buffer(config.km200.key, 'hex');
var km200host = config.km200.host;

console.log('Connect mqtt: '+config.mqtt.server);
var mqttCon = mqtt.connect(config.mqtt.server);

var desEcb = new MCrypt('rijndael-128', 'ecb');
desEcb.open(key);

function getKM200 (host, measurement, done) {
  var options = {
    url: 'http://' + host + measurement.url,
    headers: {
      'Content-type': 'application/json',
      'User-Agent': 'TeleHeater/2.2.3'
    }
  };
  request.get(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var bodyBuffer = new Buffer(body, 'base64');
      var dataBuffer = buffertrim.trimEnd(desEcb.decrypt(bodyBuffer, 'base64'));
      var result = JSON.parse(dataBuffer.toString());
      console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''), result.id, result.value, result.unitOfMeasure, measurement.groupAddress,measurement.type);
      var topic='km200' + result.id;
      var value='' + result.value;
      mqttCon.publish(topic,value, {retain: true}, function () {
        console.log(topic, value);
      });
      done(null);
    } else {
      done(null);
    }
  });
}

function checkKM200 () {
  async.eachSeries(config.measurements,
    function (measurement, cb) {
      getKM200(km200host, measurement, function (done) {
        cb(done);
      });
    },
    function (err, result) {}
  );
}

checkKM200();
var timer = setInterval(checkKM200, 60000);