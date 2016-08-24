var ModuleTestMPEG2TS = (function(global) {

var test = new Test(["MPEG2TS"], { // Add the ModuleName to be tested here (if necessary).
        disable:    false, // disable all tests.
        browser:    true,  // enable browser test.
        worker:     false,  // enable worker test.
        node:       true,  // enable node test.
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

if (IN_BROWSER || IN_NW || IN_EL || IN_NODE) {
    test.add([
        testMPEG2TS_OBS_nginx_rtmp_module,
    ]);
}

// --- test cases ------------------------------------------
function testMPEG2TS_OBS_nginx_rtmp_module(test, pass, miss) {
    var sourceFile = IN_NODE ? "test/assets/1002.live-15.ts"
                             : "../assets/1002.live-15.ts";

    //MPEG2TS.VERBOSE = false;
    //MPEG2TSParser.VERBOSE = false;
    //MPEG4ByteStream.VERBOSE = false;
debugger;

    FileLoader.toArrayBuffer(sourceFile, function(buffer) {
        console.log("testMPEG2TS: ", sourceFile, buffer.byteLength);

debugger;
        var mpeg2ts                 = MPEG2TS.demux( new Uint8Array(buffer) );
        var videoByteStream         = MPEG2TS.toByteStream( mpeg2ts["VIDEO_TS_PACKET"] );
        var videoNALUnitObjectArray = MPEG4ByteStream.convertByteStreamToNALUnitObjectArray( videoByteStream );
debugger;

        var audioByteStream         = MPEG2TS.toByteStream( mpeg2ts["AUDIO_TS_PACKET"] );
        var adts                    = ADTS.parse( audioByteStream );

debugger;
/*
        if (videoNALUnitObjectArray.length === 21 &&
            videoNALUnitObjectArray[0].NAL_UNIT_TYPE === "AUD") {
            test.done(pass());
        } else {
            test.done(miss());
        }
 */

    }, function(error) {
        console.error(error.message);
    });
}

return test.run();

})(GLOBAL);

