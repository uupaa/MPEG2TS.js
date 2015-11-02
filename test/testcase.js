var ModuleTestMPEG2TS = (function(global) {

global["BENCHMARK"] = false;

var test = new Test("MPEG2TS", {
        disable:    false, // disable all tests.
        browser:    true,  // enable browser test.
        worker:     false,  // enable worker test.
        node:       false,  // enable node test.
        nw:         false,  // enable nw.js test.
        el:         false,  // enable Electron test.
        button:     false,  // show button.
        both:       true,  // test the primary and secondary modules.
        ignoreError:false, // ignore error.
        callback:   function() {
        },
        errorback:  function(error) {
        }
    }).add([
    ]);

if (IN_BROWSER || IN_NW) {
    test.add([
        testMPEG2TS_parse,
        // browser and node-webkit test
    ]);
} else if (IN_WORKER) {
    test.add([
        // worker test
    ]);
} else if (IN_NODE) {
    test.add([
        // node.js and io.js test
    ]);
}

// --- test cases ------------------------------------------
function testMPEG2TS_parse(test, pass, miss) {
  //var url = "../../node_modules/uupaa.assetfortest.js/assets/MP4/res/ts/7.ts";
    var url = "../../node_modules/uupaa.stockmedia/res/mpeg2ts/sample1/v.stream/v000.ts";

//    MPEG2TS.VERBOSE = true;
    global["BENCHMARK"] = true;

    TypedArray.toArrayBuffer(url, function(buffer) {
        console.log("LOADED: ", url, buffer.byteLength);

        var now = performance.now();
        var ts = MPEG2TS.parse(new Uint8Array(buffer));
        var cost = performance.now() - now;

        console.log("parse cost: " + cost);
        console.dir(ts);

        test.done(pass());

    }, function(error) {
        console.log(error.message);
        test.done(error);
    });
}

return test.run();

})(GLOBAL);

