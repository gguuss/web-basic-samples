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

var game = game || {};

game.STATE_WAITING_FOR_INIT_LOAD = 0;
game.STATE_READY = 1;
game.STATE_WAITING_FOR_CLOUD = 2;
game.state = game.STATE_WAITING_FOR_INIT_LOAD;
game.currentWorld = 1;

game.init = function() {
  $('#game').fadeIn();
  game.refreshInterface();
  model.loadCloudSave(game.refreshInterface);
};

game.refreshInterface = function() {
  $("#worldLabel").text("World " + game.currentWorld);
  for (var i=1; i<=12; i++) {
    var starNum = model.getStarsFor(game.currentWorld, i);
    var starText = new Array(starNum + 1).join("\u2605") +
        new Array(5-starNum + 1).join("\u2606");

    var $buttonHtml = $("<p></p>").html("Level " + game.currentWorld + "-" + i
       + "<br>" + starText);
    $("#level" + i).html($buttonHtml);
  }
 };


game.loadCloudSave = function() {
  model.loadCloudSave(game.refreshInterface);
};

game.saveToCloud = function() {
  model.saveToCloud(game.refreshInterface);
};

game.levelClick = function(whatLevel) {
  var starNum = model.getStarsFor(game.currentWorld, whatLevel);
  starNum = starNum + 1;
  if (starNum > 5) starNum = 0;
  model.setStarsFor(game.currentWorld, whatLevel, starNum);
  game.refreshInterface();

};

game.pickWorld = function(delta) {
  game.currentWorld = game.currentWorld + delta;
  if (game.currentWorld < 0) game.currentWorld = 20;
  if (game.currentWorld > 20) game.currentWorld = 0;
  game.refreshInterface();

};

/**
 * Toggles the logged in state of the user.
 *
 * @param {string} dispName The Display Name for the currently signed in user.
 */
game.toggleLogin = function(dispName){
  if (dispName){
    $('#authorized').show();
    $('#unauthorized').hide();

    $('#personal').html('Welcome, ' + dispName + '! ' +
      '<button onClick="gapi.auth.signOut(); toggleLogin();">' +
      'Sign Out</button>');
    $('#game').fadeIn();
    game.refreshInterface();
  }else{
    $('#authorized').hide();
    $('#unauthorized').show();
    $('#personal').html('');
    $('#snapshotsArea').html('');
    $('#game').fadeOut();$
  }
}

/**
 * This callback for when the Google+ client library loads personalizes the
 * game.
 */
game.onPlusLoaded = function(){
  console.log('Plus API loaded, personalizing: ');
  gapi.client.plus.people.get({userId: 'me'}).execute(function(resp){
    game.toggleLogin(resp.displayName);
  });
}

/**
 * After the Games API client has successfully loaded, this method will
 * retrieve the snapshots and list them for the user.
 */
game.onClientLoaded = function(){
  console.log('Games API loaded, listing snapshots.');

  var loadDefaultSnapshot = function(snapshotResult){
    for (var i=0; i < snapshotResult.items.length; i++){
      if (snapshotResult.items[i].uniqueName == "snapshotTemp"){
        model.lastSnapshot = snapshotResult.items[i];
      }
    }
    if (!model.lastSnapshot){
      model.lastSnapshot = snapshotResult.items[0];
    }
    model.openSnapshot(model.lastSnapshot.driveId, model.lastSnapshot.id,
      function(resp) {
        model.inv.loadDataFromCloud(JSON.parse(resp));
        game.refreshInterface();
        $('#snaps').hide();
      });
  }

  game.loadSnapshots(loadDefaultSnapshot);
}


/**
 * Loads the snapshots into the load game div.
 */
game.loadSnapshots = function(callback){
  gapi.client.games.snapshots.list({playerId:'me'}).execute(
    function (res){
      $('#snapshotsArea').html('');
      console.log(res);
      if (res.result.items){
        for (var i=0; i < res.result.items.length; i++){
          var currSnap = res.result.items[i];
          var html = game.getSnapshotHTML(currSnap);
          $('#snapshotsArea').html(html + $('#snapshotsArea').html());
          if (callback){
            callback(res);
          }
        }
      } else {
        model.lastSnapshot = {
          "kind":"games#snapshot",
          "uniqueName":"snapshotTemp",
          "type":"SAVE_GAME",
          "title":"snapshotTemp",
          "description":"Modified data at: " + new Date(),
          "coverImage":
            {
              "kind":"games#snapshotImage",
              "width":414,"height":492,
              "mime_type":"image/png",
              "url":""
            },
            "lastModifiedMillis":"1406933676066",
            "durationMillis":"0",
        };
      }
    });
}

/**
 * Gets the HTML for a snapshot div.
 *
 * @param {object} snapshot The snapshot to create HTML for.
 */
game.getSnapshotHTML = function(currSnap){
  var html = '<div style="border-style:solid; border-color:#909090; border-size:2px; margin-right:5px; padding:20px;">\n';

  // Image div
  html += '  <div style="cursor: pointer;" onclick="model.openSnapshot(\'' +
      currSnap.driveId + "','" + currSnap.id + '\')"' + ';>\n';
  html += '    <img src="' + currSnap.coverImage.url + '" />\n' + '  </div>';
  // Description div
  html += '  <div>' + currSnap.description + '</div>';

  html += '</div>';
  return html;
};


/**
 * Draws the image data to hidden canvas and returns the data stream as
 * a base64 string.
 */
game.getSnapshotImageData = function(){
  var canvas = document.getElementById('snapImage');
  var ctx = canvas.getContext('2d');

  var currLevels = model.inv.getCloudSaveData();
  var levelNames = Object.keys(currLevels.levels).sort();
  for (var index = 0; index < levelNames.length; index++){
    ctx.font = "10px Arial";
    var starString = '';
    for (var starIndex = 0; starIndex < 5; starIndex++){
      if (starIndex < currLevels.levels[levelNames[index]]){
        starString += '\u2605';
      }else{
        starString += '\u2606';
      }
    }

    ctx.fillText("Level: " + JSON.stringify(levelNames[index]) + ' / ' +
        starString, // currLevels.levels[levelNames[index]] + '/5',
        10, 15 + (15 * index) );
  }

  console.log(canvas.toDataURL().split(',')[0]);
  return canvas.toDataURL().split(',')[1];
}
