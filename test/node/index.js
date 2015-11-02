// MPEG2TS test

require("../../lib/WebModule.js");

// publish to global
WebModule.publish = true;

require("../../node_modules/uupaa.bit.js/lib/Bit.js");
require("../../node_modules/uupaa.bit.js/lib/BitView.js");
require("../../node_modules/uupaa.hash.js/lib/Hash.js");
require("../../node_modules/uupaa.typedarray.js/lib/TypedArray.js");
require("../../node_modules/uupaa.m3u.js/lib/M3U.js");
require("../wmtools.js");
require("../../lib/MPEG2TS.js");
require("../../release/MPEG2TS.n.min.js");
require("../testcase.js");

