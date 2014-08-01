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
model.imageFile = {};
model.lastSnapshot = {};
model.DRIVE_HOST_PATH = 'https://googledrive.com/host/';
model.HOST_FOLDER = "snapshotImages";
model.lastFileId = undefined;
model.lastUri = undefined;
model.hostFolderId = undefined;
model.snapshotImageLink = undefined;

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
        console.log(resp);
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

  // TODO (class) Use canvas element to update cover photo
  model.uploadPublicImage(model.lastSnapshot.title);

};

model.uploadSnapshotMetadata = function(callback) {
  var boundary = '-------374159275358879320846';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";

  var contentType = 'application/octet-stream';
  var boundary = '-------374159275358879320846';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";

  var contentType = 'application/octet-stream';
  // Update the description in the snapshot metadata.
  model.lastSnapshot.coverImage.url = model.imageFile.webContentLink;
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


/**
 * Creates a public folder.
 */
model.createPublicFolder = function (folderName, callback) {
  var body = {
    'title': folderName,
    'mimeType': 'application/vnd.google-apps.folder'
  };

  var request = gapi.client.drive.files.insert({
    'resource': body
  });

  request.execute(function(resp) {
    console.log(resp);
    model.hostFolderId = resp.id;
    var permissionBody = {
      'value': '',
      'type': 'anyone',
      'role': 'reader'
    };
    var permissionRequest = gapi.client.drive.permissions.insert({
      'fileId': resp.id,
      'resource': permissionBody
    });
    permissionRequest.execute(callback);
  });
}

/**
 * Start the file upload.
 *
 * @param {Object} name File name to save as.
 */
model.uploadPublicImage = function (name){
  // Callback to either insert the file into an existing
  // folder or use an existing folder returned from search.
  var callback = function(resp){
    console.log(resp);

    if (model.hostFolderId == undefined){
      model.createPublicFolder(model.HOST_FOLDER, function() {
          model.findFileInFolder(name + '.png', model.hostFolderId, function() {
              model.uploadImageData(name + '.png', model.lastFileId);
          });
      });
    }else{
      model.findFileInFolder(name + '.png', model.hostFolderId, function() {
          model.uploadImageData(name + ".png", model.lastFileId);
      });
    }
  };
  model.searchForFolder(model.HOST_FOLDER, callback);
};

/**
 * Upload image file.
 */
model.uploadImageData = function(name, fileId, callback){
  var boundary = '-------314159265358979323846';
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";
  var method = "POST";
  var path ='/upload/drive/v2/files';

  var contentType = 'image/png';
  var metadata = {
    'title': name,
    'mimeType': contentType
  };

  if (fileId != undefined){
    metadata["fileId"] = fileId;
    method = "PUT";
    path += '/' + fileId;
  }

  var multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + contentType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      game.getSnapshotImageData() +
      close_delim;

  gapi.client.request(
      {
      'path': path,
      'method': method,
      'params': {'uploadType': 'multipart'},
      'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody
    }).execute(function (newFile){
        model.imageFile = newFile;
        model.lastFileId = newFile.id;
        model.insertFileIntoFolder(model.hostFolderId, newFile.id);
        model.uploadSnapshotMetadata();
      });
};


/**
 * Insert a file into a folder.
 *
 * @param {String} folderId ID of the folder to insert the file into.
 * @param {String} fileId ID of the file to insert.
 */
model.insertFileIntoFolder = function (folderId, fileId) {
  var body = {'id': folderId};
  var request = gapi.client.drive.parents.insert({
    'fileId': fileId,
    'resource': body
  });
  request.execute(function(resp) {
      console.log(resp);
    });
}


/**
 * Get the Google Drive-hosted URL for the file.
 * @param {String} folderId The ID of the folder on Google Drive hosting the
 *                 file.
 * @param {String} folderId The ID of the folder on Google Drive hosting the
 *                 file.
 *
 * @return {String} URI encoded path to the Google Drive hosted file.
 */
model.getFilePath = function(folderId, fileName){
  return model.DRIVE_HOST_PATH + encodeURI(folderId) + '/' + encodeURI(fileName);
}

/**
 * Check if a file exists in a folder.
 *
 * @param {String} fileName The name of the file to search for.
 * @param {String} folderId The name of the folder that must contain the file.
 * @param {Function} callback A function called after the response completes.
 *
 */
model.findFileInFolder = function (fileName, folderId, callback){
  var query = 'title = "' + fileName + '" and trashed = false';

  var request = gapi.client.drive.files.list({
    'q': query
  });

  request.execute(function(resp){
    if (resp.items != null){
      model.lastFileId = resp.items[0].id;
    }
    callback(resp);
  });
}

/**
 * Search for a folder. Note that this application only request the
 * permissions to read and write its own folders and files so we can safely
 * assume that user-created folders will not appear here.
 *
 * @param {String} folderName The name of the folder to find.
 * @param {Function} callback Function to call when the request is complete.
 */
model.searchForFolder = function (folderName, callback) {
  var request = gapi.client.drive.files.list({
    'q': 'title = "' + folderName + '" and trashed = false'
  });

  request.execute(function(resp) {
    console.log(resp);
    if (resp.items != undefined){
      model.hostFolderId = resp.items[0].id;
    }
    callback(resp);
  });
}


/**
 * Retrieves stars for a world/level.
 */
model.getStarsFor = function(world, level) {
  return model.inv.getStarsFor(world, level);
};

/**
 * Sets stars for a world/level.
 */
model.setStarsFor = function(world, level, newNum){
  model.inv.setStarsFor(world, level, newNum);
};
