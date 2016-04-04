var ModuleTestMPEG2TS = (function(global) {

var test = new Test(["MPEG2TS"], { // Add the ModuleName to be tested here (if necessary).
        disable:    false, // disable all tests.
        browser:    true,  // enable browser test.
        worker:     false,  // enable worker test.
        node:       false,  // enable node test.
        nw:         true,  // enable nw.js test.
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

if (IN_BROWSER || IN_NW || IN_EL) {
    test.add([
        testMPEG2TS,
    ]);
}

// --- test cases ------------------------------------------
function testMPEG2TS(test, pass, miss) {
    var sourceFile = "../assets/ff/png.all.mp4.00.ts";

    FileLoader.toArrayBuffer(sourceFile, function(buffer) {
        console.log("testMPEG2TS: ", sourceFile, buffer.byteLength);

        var mpeg2ts                 = MPEG2TS.parse( new Uint8Array(buffer) );
        var videoByteStream         = MPEG2TS.convertTSPacketToByteStream( mpeg2ts["VIDEO_TS_PACKET"] );
        var videoNALUnitObjectArray = MPEG4ByteStream.convertByteStreamToNALUnitObjectArray( videoByteStream );

        test.done(pass());

    }, function(error) {
        console.error(error.message);
    });
}

return test.run();

})(GLOBAL);

