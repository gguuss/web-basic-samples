/**
 * Created with IntelliJ IDEA.
 * User: kerp
 * Date: 5/11/13
 * Time: 1:56 PM
 *
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

"use strict";

var model = model || {};
model.inv = new Inventory();
model.INVENTORY_SLOT = 0;
model.lastSnapshot = {};

// TODO (class) accept snapshot object instead of ids
/**
 * Opens a snapshot using the games API.
 *
 * @param {string} driveId The identifier for the drive file to open.
 * @param {string} id The identifier for the snapshot to open.
 * @param {function} callback Called after the data is retrieved.
 */
model.openSnapshot = function(driveId, snapshotId, callback){
  callback = callback ||
      function(resp) {
        model.inv.loadDataFromCloud(JSON.parse(resp));
        game.refreshInterface();
        $('#snaps').hide();
      };

  model.updateLastSnapshot(snapshotId);
  gapi.client.drive.files.get({fileId: driveId}).execute(
    function(ss){
      model.downloadFile(ss,callback);
    });
}

/**
 * Download a Drive file's content.
 *
 * @param {File} file Drive File instance.
 * @param {Function} callback Function to call when the request is complete.
 */
model.downloadFile = function (file, callback) {
  if (file.downloadUrl) {
    var accessToken = gapi.auth.getToken().access_token;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', file.downloadUrl);
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    xhr.onload = function() {
      callback(xhr.responseText);
    };
    xhr.onerror = function() {
      callback(null);
    };
    xhr.send();
  } else {
    callback(null);
  }
}

/**
 * Updates the model with the current snapshot data.
 */
model.updateLastSnapshot = function(snapshotId){
  gapi.client.games.snapshots.get({snapshotId:snapshotId}).execute(
      function(snapshot) {
        model.lastSnapshot = snapshot;
      }
  );
}

/**
 * Finds and saves the snapshot.
 */
model.saveSnapshot = function(){
  // TODO: show conflicts
  // Find the snapshot save file
  gapi.client.drive.files.list(
    {q:'title = "' + model.lastSnapshot.title + '" and mimeType = ' +
        '"application/vnd.google-play-games.snapshot"'}).
      execute(function(r){console.log(r)});
}

/**
 * Update a drive file.
 *
 * @param {function} callback Function called after the file is uploaded.
 */
model.uploadLastSnapshot = function(callback){
  var boundary = '-------374159275358879320846';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";

  var contentType = 'application/octet-stream';

  // TODO (class) Use canvas element to update cover photo
  // var pngCover = document.getElementById('snapshotCanvas').toDataURL();
  // Update the description in the snapshot metadata.
  model.lastSnapshot.description = 'Modified data at: ' + new Date();


  var base64Data = btoa(JSON.stringify(model.inv.getCloudSaveData()));
  model.lastSnapshot.id = model.lastSnapshot.driveId;
  var multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(model.lastSnapshot) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      base64Data +
      close_delim;

  var request = gapi.client.request({
      'path': '/upload/drive/v2/files/' + model.lastSnapshot.driveId,
      'method': 'PUT',
      'params': {'uploadType': 'multipart', 'alt': 'json'},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody});
  if (!callback) {
    callback = function(file) {
      console.log(file)
    };
  }
  request.execute(callback);
};


model.getStarsFor = function(world, level) {
  return model.inv.getStarsFor(world, level);
};

model.setStarsFor = function(world, level, newNum){
  model.inv.setStarsFor(world, level, newNum);
};
