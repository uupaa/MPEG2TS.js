var ModuleTestMPEG2TS = (function(global) {

var test = new Test(["MPEG2TS"], { // Add the ModuleName to be tested here (if necessary).
        disable:    false, // disable all tests.
        browser:    false,  // enable browser test.
        worker:     false,  // enable worker test.
        node:       false,  // enable node test.
        nw:         false,  // enable nw.js test.
        el:         true,  // enable electron (render process) test.
        button:     true,  // show button.
        both:       false,  // test the primary and secondary modules.
        ignoreError:false, // ignore error.
        callback:   function() {
        },
        errorback:  function(error) {
            console.error(error.message);
        }
    });

/*
if (IN_BROWSER || IN_NW || IN_EL || IN_WORKER || IN_NODE) {
    test.add([
        testMPEG2TS_get_timing_and_duration,
    ]);
}
if (IN_BROWSER || IN_NW || IN_EL) {
    test.add([
    ]);
}
if (IN_WORKER) {
    test.add([
    ]);
}
if (IN_NODE) {
    test.add([
    ]);
}
 */
if (IN_EL) {
    test.add([
        testMPEG2TS_get_timing_and_duration,
    ]);
}

// --- test cases ------------------------------------------
function testMPEG2TS_get_timing_and_duration(test, pass, miss) {
    var fs = require("fs");
    var sourceFile = "../assets/ff/png.all.mp4.00.ts";

    TypedArray.toArrayBuffer(sourceFile, function(buffer) {
        console.log("LOAD FROM: ", sourceFile, buffer.byteLength);

        var mpeg2ts                 = MPEG2TS.parse(new Uint8Array(buffer));
        var videoPESPacket          = MPEG2TS.convertPacketToPESPacket(mpeg2ts["VIDEO_TS_PACKET"]);
        var videoByteStream         = MPEG2TS.convertPESPacketToByteStream(videoPESPacket);
        //var videoNALUnitArray       = ByteStream.toNALUnit(videoByteStream);
        //var videoNALUnitObjectArray = NALUnit.toNALUnitObject(videoNALUnitArray);

        test.done(pass());

    }, function(error) {
        console.error(error.message);
    });
}

return test.run();

})(GLOBAL);

