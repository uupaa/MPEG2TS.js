# MPEG2TS.js [![Build Status](https://travis-ci.org/uupaa/MPEG2TS.js.svg)](https://travis-ci.org/uupaa/MPEG2TS.js)

[![npm](https://nodei.co/npm/uupaa.mpeg2ts.js.svg?downloads=true&stars=true)](https://nodei.co/npm/uupaa.mpeg2ts.js/)

MPEG-2 TS Demuxer.

This module made of [WebModule](https://github.com/uupaa/WebModule).

## Documentation
- [Spec](https://github.com/uupaa/MPEG2TS.js/wiki/)
- [API Spec](https://github.com/uupaa/MPEG2TS.js/wiki/MPEG2TS)

## Setup

```sh
$ cd test/assets
$ ./make_video
```

## Browser, NW.js and Electron

```js
<script src="<module-dir>/lib/WebModule.js"></script>
<script src="<module-dir>/lib/MPEG2TS.js"></script>
<script>
    ...
</script>
```

## WebWorkers

```js
importScripts("<module-dir>lib/WebModule.js");
importScripts("<module-dir>lib/MPEG2TS.js");

```

## Node.js

```js
require("<module-dir>lib/WebModule.js");
require("<module-dir>lib/MPEG2TS.js");

```

