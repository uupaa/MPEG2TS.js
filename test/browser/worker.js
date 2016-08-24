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

    WebModule.VERIFY  = true;
    WebModule.VERBOSE = true;
    WebModule.PUBLISH = true;

    importScripts("../../node_modules/uupaa.typedarray.js/lib/TypedArray.js");
    importScripts("../../node_modules/uupaa.aac.js/node_modules/uupaa.bit.js/lib/Bit.js");
    importScripts("../../node_modules/uupaa.aac.js/node_modules/uupaa.bit.js/lib/BitView.js");
    importScripts("../../node_modules/uupaa.aac.js/node_modules/uupaa.hash.js/lib/Hash.js");
    importScripts("../../node_modules/uupaa.aac.js/lib/AAC.js");
    importScripts("../../node_modules/uupaa.aac.js/lib/ADTS.js");
    importScripts("../../node_modules/uupaa.base64.js/lib/Base64.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.hexdump.js/lib/HexDump.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitType.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitParameterSet.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitEBSP.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitAUD.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitSPS.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitPPS.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitSEI.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitIDR.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitNON_IDR.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnit.js");
    importScripts("../../node_modules/uupaa.mpeg4bytestream.js/lib/MPEG4ByteStream.js");
    importScripts("../../node_modules/uupaa.fileloader.js/node_modules/uupaa.uri.js/lib/URI.js");
    importScripts("../../node_modules/uupaa.fileloader.js/node_modules/uupaa.uri.js/lib/URISearchParams.js");
    importScripts("../../node_modules/uupaa.fileloader.js/lib/FileLoader.js");
    importScripts("../../node_modules/uupaa.fileloader.js/lib/FileLoaderQueue.js");
    importScripts("../wmtools.js");
    importScripts("../../lib/MPEG2TSNALUnit.js");
    importScripts("../../lib/MPEG2TSDemuxer.js");
    importScripts("../../lib/MPEG2TS.js");
    importScripts("../../release/MPEG2TS.w.min.js");
    importScripts("../testcase.js");

    self.postMessage(self.unitTest);
};

