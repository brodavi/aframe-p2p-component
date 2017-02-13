/* global AFRAME */

var swarmlog = require('unsigned-swarmlog')
var memdb = require('memdb')
var debounce = require('throttle-debounce/debounce')

// from http://stackoverflow.com/questions/9407892/how-to-generate-random-sha1-hash-to-use-as-id-in-node-js#14869745
// str byteToHex(uint8 byte)
//   converts a single byte to a hex string 
function byteToHex (byte) {
  return ('0' + byte.toString(16)).slice(-2)
}

// from http://stackoverflow.com/questions/9407892/how-to-generate-random-sha1-hash-to-use-as-id-in-node-js#14869745
// str generateId(int len);
//   len - must be an even number (default: 40)
function generateId (len) {
  var arr = new Uint8Array((len || 40) / 2)
  window.crypto.getRandomValues(arr)
  return [].map.call(arr, byteToHex).join("")
}

if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

appendLog = function (opts) {
  // append this object change to the hyperlog, replicating to peers
  opts.log.append({
    time: Date.now(),
    originator: opts.origin,
    msg: {
      action: opts.action,
      data: opts.data
    }
  })
}

debouncedAppendLog = debounce(1000, appendLog)

/**
 * Peer-to-Peer component for A-Frame.
 */
AFRAME.registerComponent('p2p', {
  schema: {
    signalhub: {type: 'string'},
    topic: {type: 'string'}
  },

  /**
   * Set if component needs multiple instancing.
   */
  multiple: false,

  /**
   * Called once when component is attached. Generally for initial setup.
   */
  init: function () {
    var self = this

    self.topic = window.prompt('Would you like to join a custom p2p channel?\
    Type or paste it below and share with your friends. Otherwise click cancel\
    to join the default p2p channel (beware.. this is the internet after all).')

    var topic = self.topic || self.attrValue.topic || 'mytopic'

    self.log = swarmlog({
      db: memdb(),
      topic: topic,
      valueEncoding: 'json',
      hubs: [ self.attrValue.signalhub || 'https://signalhub.mafintosh.com' ]
    })

    self.swarm = self.log.swarm

    console.log('My swarm ID: ', self.swarm.me)

    //
    // what to do when an object's component has changed
    //
    // NOTE: we don't want to overload the hyperlog with changes, so we
    // *sometimes* debounce to 1 second
    //
    self.handleComponentChanged = function (e) {

      var child = e.detail.target

      if (e.detail.type === 'componentinitialized' &&
          (e.detail.name === 'position' ||
           e.detail.name === 'rotation' ||
           e.detail.name === 'scale' ||
           e.detail.name === 'visible')) {
        // A-Frame will automatically initialize these four components.
        return
      }

      if (child.dataset.remotelychanged === "true") {
        // this child that was just changed was changed by way of the hyperlog,
        // so do not append the change to the hyperlog also set the flag to
        // false, in case this peer needs to change it
        child.dataset.remotelychanged = "false";
        return
      }

      var componentName = e.detail.name

      // take into account component initialized event
      var componentData = e.detail.newData || e.detail.data

      // This warrants some explaination. If a user moves around an object in
      // the editor, every one of the hundreds of changes leading from point A
      // to point B trigger a 'componentchanged' event. We don't want every
      // single one recorded in the hyperlog. So we debounce. However, if the
      // user moves the object around, is satisfied where it is, and then
      // changes the color, the only change recorded is the color, because of
      // the debounce. So if we get 2 property updates in a row of the same
      // property, we use the debounce function. But if they differ, then it
      // swaps.
      if (!self.debounce) {
        appendLog({
          action: 'child-changed',
          log: self.log,
          origin: self.swarm.me,
          data: {
            componentName: componentName,
            componentData: componentData,
            p2pid: child.dataset.p2pid
          }
        })
        self.debounce = componentName
      } else if (self.debounce && self.debounce !== componentName) {
        appendLog({
          action: 'child-changed',
          log: self.log,
          origin: self.swarm.me,
          data: {
            componentName: componentName,
            componentData: componentData,
            p2pid: child.dataset.p2pid
          }
        })
        self.debounce = null
      } else {
        debouncedAppendLog({
          action: 'child-changed',
          log: self.log,
          origin: self.swarm.me,
          data: {
            componentName: componentName,
            componentData: componentData,
            p2pid: child.dataset.p2pid
          }
        })
        self.debounce = componentName
      }
    }

    //
    // what to do when a child has been attached (probably by the inspector)
    //
    self.el.addEventListener('child-attached', function (e) {
      var child = e.detail.el

      if (document.body.classList.contains('aframe-inspector-opened')) {
        // this object was created with the inspector.. so give it an id
        child.dataset.p2pid = generateId()
      }

      // we only want to deal with p2p objects
      if (child.dataset.p2pid) {

        if (child.dataset.remotelyattached === "true") {
          // this child that was just attached was attached by way of the
          // hyperlog, so don't log it
          return
        }

        // add a class of p2p for selecting upon removal
        child.classList.add('p2p')

        // append this object to the hyperlog, replicating to peers
        appendLog({
          action: 'child-attached',
          log: self.log,
          origin: self.swarm.me,
          data: {
            nodeType: child.nodeName,
            p2pid: child.dataset.p2pid
          }
        })

        // add the component changed handler
        child.addEventListener(
          'componentchanged',
          self.handleComponentChanged
        )
        child.addEventListener(
          'componentinitialized',
          self.handleComponentChanged
        )
      }
    })

    //
    // what to do when a child has been detached (probably by the inspector)
    //
    self.el.addEventListener('child-detached', function (e) {
      var child = e.detail.el

      // we only want to deal with objects with the p2pid data attribute
      if (child.dataset.p2pid) {

        if (child.dataset.remotelydetached === "true") {
          // this child that was just detached was detached by way of the
          // hyperlog, so don't log it
          return
        }

        appendLog({
          action: 'child-detached',
          log: self.log,
          origin: self.swarm.me,
          data: child.dataset.p2pid
        })
      }

    })

    //
    // set the hyperlog to replicate
    //
    self.log.createReadStream({ live: true })
    .on('data', function (data) {

      if (data.value.originator === self.swarm.me) {
        // ignore any actions from self
        return
      } else {

        if (data.value.msg.action === 'child-attached') {

          var newChild = document.createElement(data.value.msg.data.nodeType)

          // got the components... let's do the id now
          newChild.dataset.p2pid = data.value.msg.data.p2pid

          // mark it as remotelyattached from hyperlog
          newChild.dataset.remotelyattached = "true"

          // add a class of p2p for selecting upon removal
          newChild.classList.add('p2p')

          // add the component changed handler
          newChild.addEventListener(
            'componentchanged',
            self.handleComponentChanged
          )
          newChild.addEventListener(
            'componentinitialized',
            self.handleComponentChanged
          )

          self.el.appendChild(newChild)

        } else if (data.value.msg.action === 'child-detached') {

          // find all the objects with class of 'p2p'
          var possiblyDoomed = self.el.querySelectorAll('.p2p')

          if (possiblyDoomed.length > 0) {
            for (var x = 0; x < possiblyDoomed.length; x++) {
              if (possiblyDoomed[x].dataset.p2pid === data.value.msg.data) {

                // mark it as remotelydetached from hyperlog
                possiblyDoomed[x].dataset.remotelydetached = "true"

                self.el.removeChild(possiblyDoomed[x])

                break
              }
            }
          }
        } else if (data.value.msg.action === 'child-changed') {

          var possiblyChanged = self.el.querySelectorAll('.p2p')

          if (possiblyChanged.length > 0) {
            for (var x = 0; x < possiblyChanged.length; x++) {
              if (possiblyChanged[x].dataset.p2pid ===
                  data.value.msg.data.p2pid) {

                // mark it as remotelychanged from hyperlog
                possiblyChanged[x].dataset.remotelychanged = "true"

                // make the change
                possiblyChanged[x].setAttribute(
                  data.value.msg.data.componentName,
                  data.value.msg.data.componentData
                )

                break
              }
            }
          }
        }
      }
    })

  },

  /**
   * Called when component is attached and when component data changes.
   * Generally modifies the entity based on the data.
   */
  update: function (oldData) { },

  /**
   * Called when a component is removed (e.g., via removeAttribute).
   * Generally undoes all modifications to the entity.
   */
  remove: function () { },

  /**
   * Called on each scene tick.
   */
  // tick: function (t) { },

  /**
   * Called when entity pauses.
   * Use to stop or remove any dynamic or background behavior such as events.
   */
  pause: function () { },

  /**
   * Called when entity resumes.
   * Use to continue or add any dynamic or background behavior such as events.
   */
  play: function () { }
});
