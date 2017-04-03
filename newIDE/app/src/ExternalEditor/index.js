import Bridge from './Bridge.js';
import React, { Component } from 'react';
import Window from '../Utils/Window.js';
const gd = global.gd;

class ExternalEditor extends Component {
  constructor() {
    super();
    this.bridge = new Bridge();
    this.editorArguments = Window.getArguments();
    this.selectedEditor = this.editorArguments['editor'];
    this.editedElementName = this.editorArguments['edited-element-name'];
    this.isIntegrated = this.editorArguments['mode'] === 'integrated';
    this.state = {
      loading: false,
    };

    if (this.bridge.isSupported()) {
      console.log('Connection to an external editor...');

      this.bridge.onReceive((command, payload, scope) => {
        if (command === 'update') {
          this._onUpdateReceived(payload, scope);
        } else if (command === 'setBounds') {
          if (this.isIntegrated) {
            Window.setBounds(
              payload.x,
              payload.y,
              payload.width,
              payload.height
            );
          }
        } else if (command === 'show') {
          Window.show();
        } else if (command === 'hide') {
          if (this.isIntegrated) {
            Window.hide();
          }
        }
      });
      this.bridge.onConnected(() => {
        this.requestUpdate('', true);
      });
      Window.onBlur(() => {
        if (this.isIntegrated) {
          Window.hide();
        }
        this.sendUpdate();
      });
      Window.onFocus(() => {
        this.requestUpdate();
      });
      Window.onClose(() => {
        this.sendUpdate();
      });

      this.bridge.connectTo(this.editorArguments['server-port']);
    } else {
      console.warn('Connection to an external editor is not supported');
    }
  }

  sendUpdate = () => {
    console.log('Sending update to server editor');
    if (this.state.loading) {
      console.warn('Already loading an update, abort send');
      return;
    }
    if (this.sendingUpdate) {
      console.warn('Already sending an update, abort send');
      return;
    }
    if (!this.editor) {
      console.error(
        'No children editor to use to get the updated edited element'
      );
      return;
    }

    this.sendingUpdate = true;
    const elements = this.editor.getSerializedElements();
    for (const scope in elements) {
      if (elements.hasOwnProperty(scope)) {
        this.bridge.send('update', elements[scope], scope);
      }
    }
    this.sendingUpdate = false;

    console.log('Update send done');
  };

  launchPreview = () => {
    this.sendUpdate();
    this.bridge.send('requestPreview', undefined);
  };

  /**
   * Request an update to the server. Note that if forcedUpdate is set to false,
   * the server may not send back an update (for example if nothing changed).
   */
  requestUpdate = (scope = '', forcedUpdate = false) => {
    const command = forcedUpdate ? 'requestForcedUpdate' : 'requestUpdate';
    this.bridge.send(command, undefined, scope);
  };

  _onUpdateReceived = (payload, scope) => {
    console.log('Received project update from server');
    if (scope !== '') {
      console.warn(`Not implemented: received ${scope} update from server`);
      return;
    }

    this.setState(
      {
        loading: true,
      },
      () => setTimeout(() => {
        // Transform the payload into a gd.SerializerElement
        // Note that gd.Serializer.fromJSObject returns a new gd.SerializerElement object at every call
        if (this._serializedObject) this._serializedObject.delete();

        var t1 = performance.now();
        this._serializedObject = gd.Serializer.fromJSObject(payload);
        var t2 = performance.now();
        console.log(
          'Call to gd.Serializer.fromJSObject took ' +
            (t2 - t1) +
            ' milliseconds.'
        );

        this.editor.loadFullProject(this._serializedObject, () => {
          this._serializedObject.delete();
          this._serializedObject = null;
          this.setState({
            loading: false,
          });
        });
      }),
      10 // Let some time for the loader to be shown
    );
  };

  render() {
    return React.cloneElement(this.props.children, {
      loading: this.state.loading,
      ref: editor => this.editor = editor,
      requestUpdate: () => this.requestUpdate('', true),
      onPreview: this.launchPreview,
      selectedEditor: this.selectedEditor,
      editedElementName: this.editedElementName,
    });
  }
}

export default ExternalEditor;
