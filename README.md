## aframe-p2p-component

WORK IN PROGRESS  [demo](https://brodavi.github.io/aframe-p2p-component/basic/)

A component for [A-Frame](https://aframe.io) that enables sharing and updating objects with multiple peers over p2p WebRTC.

Built on top of [unsigned-swarmlog](http://npmjs.org/package/unsigned-swarmlog), a WebRTC swarm that swarms around a [hyperlog](https://www.npmjs.com/package/hyperlog), an append-only Merkle DAG that replicates based on scuttlebutt logs and causal linking.

The A-Frame objects created with the [A-Frame inspector](https://aframe.io/docs/master/guides/using-the-aframe-inspector.html) persist in memory via [memdb](http://npmjs.org/package/memdb) but could be altered to use leveldb if desired.

Note that [substack's](https://www.npmjs.com/~substack) original [swarmlog](http://npmjs.org/package/swarmlog) is intended to be a cryptographically-secure means of ensuring a publisher to a hyperlog is who they say they are. aframe-p2p-component uses a fork of this project that ignores the cryptographically-secure signing aspect of swarmlog, assuming that small teams of trusted individuals will be using this component to collaboratively build A-Frame scenes and objects without any servers.

CAVEATS: Be warned that not all objects are working just yet.

WARNING!: Physics and animation will trigger position and rotation changed events very frequently. The updating to hyperlog is de-bounced but nevertheless, it is NOT recommended that you use physics or animation with this component at this time.

### API

| Property | Description | Default Value |
| -------- | ----------- | ------------- |
| signalhub| the signalling server url which is required for the peers to find each other | https://signalhub.mafintosh.com |
| topic    | the topic (id) of the p2p channel the peers will be swarming in | 'mytopic' |

NOTE: HTTPS seems to be necessary sometimes for the signalhub property value.

### Installation

#### Browser

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.5.0/aframe.min.js"></script>
  <script src="https://rawgit.com/brodavi/aframe-p2p-component/master/dist/aframe-p2p-component.min.js"></script>
</head>

<body>
  <a-scene p2p="signalhub: https://somesignalhub.com; topic: myprivatetopic">
  </a-scene>
</body>
```

<!-- If component is accepted to the Registry, uncomment this. -->
<!--
Or with [angle](https://npmjs.com/package/angle/), you can install the proper
version of the component straight into your HTML file, respective to your
version of A-Frame:

```sh
angle install aframe-p2p-component
```
-->

#### npm

Install via npm:

```bash
npm install aframe-p2p-component
```

Then require and use.

```js
require('aframe');
require('aframe-p2p-component');
```
