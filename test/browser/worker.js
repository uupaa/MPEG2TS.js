// MPEG2TS test

onmessage = function(event) {
    self.unitTest = event.data; // { message, setting: { secondary, baseDir } }

    if (!self.console) { // polyfill WebWorkerConsole
        self.console = function() {};
        self.console.dir = function() {};
        self.console.log = function() {};
        self.console.warn = function() {};
        self.console.error = function() {};
        self.console.table = function() {};
    }

    importScripts("../../lib/WebModule.js");

    WebModule.verify  = true;
    WebModule.verbose = true;
    WebModule.publish = true;

    importScripts("../../node_modules/uupaa.bit.js/lib/Bit.js");
    importScripts("../../node_modules/uupaa.bit.js/lib/BitView.js");
    importScripts("../../node_modules/uupaa.hash.js/lib/Hash.js");
    importScripts("../../node_modules/uupaa.hexdump.js/lib/HexDump.js");
    importScripts("../../node_modules/uupaa.fileloader.js/lib/FileLoader.js");
    importScripts("../wmtools.js");
    importScripts("../../lib/MPEG2TSParser.js");
    importScripts("../../lib/MPEG2TS.js");
    importScripts("../../release/MPEG2TS.w.min.js");
    importScripts("../testcase.js");

    self.postMessage(self.unitTest);
};

