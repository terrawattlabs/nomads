const express = require('express');
const session = require('express-session');

var request = require('request');
var schedule = require('node-schedule');
var url = require('url');

var Stamplay = require("stamplay");
var stamplay = new Stamplay("nomads", "febd530624058ec0ad071f5c9b2b1de2f80094d14000e320547fbf81ace1824e");

var EmailTemplate = require('email-templates').EmailTemplate;
var path = require('path');
var polyline = require('polyline');
var moment = require('moment');



var sg = require('sendgrid')("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");




const port = process.env.PORT || 3000;
const app = express();

// Add your automatic client id and client secret here or as environment variables
const AUTOMATIC_CLIENT_ID = process.env.AUTOMATIC_CLIENT_ID || 'c24caca06ff7d9008e0f';
const AUTOMATIC_CLIENT_SECRET = process.env.AUTOMATIC_CLIENT_SECRET || 'b05d51a932fb6a24ba6fb3b415d6644f065e6146';

const oauth2 = require('simple-oauth2')({
  clientID: "c24caca06ff7d9008e0f",
  clientSecret: "b05d51a932fb6a24ba6fb3b415d6644f065e6146",
  site: 'https://accounts.automatic.com',
  tokenPath: '/oauth/access_token'
});

// Authorization uri definition
const authorizationUri = oauth2.authCode.authorizeURL({
  scope: 'scope:user:profile scope:trip scope:location scope:vehicle:profile scope:vehicle:events scope:behavior'
});

// Enable sessions
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}));

// Initial page redirecting to Automatic's oAuth page
app.get('/auth', (req, res) => {
  res.redirect(authorizationUri);
});

// Callback service parsing the authorization token and asking for the access token
app.get('/redirect', (req, res) => {
  const code = req.query.code;

  function saveToken(error, result) {
    if (error) {
      console.log('Access token error', error.message);
      res.send('Access token error: ' +  error.message);
      return;
    }

    // Attach `token` to the user's session for later use
    // This is where you could save the `token` to a database for later use
    req.session.token = oauth2.accessToken.create(result);

    res.redirect('/welcome');
  }

  oauth2.authCode.getToken({
    code: code
  }, saveToken);
});


app.get('/welcome', (req, res) => {

  if (req.query.code) {
    // Display token to authenticated user
    //console.log('Automatic access token', req.session.token.token.access_token);
    
    var automatic_code = req.query.code;

    var dataObj = {
      "client_id": "c24caca06ff7d9008e0f",
      "client_secret" : "b05d51a932fb6a24ba6fb3b415d6644f065e6146",
      "code" : automatic_code,
      "grant_type" : "authorization_code"
       };

    var dataString = "client_secret=b05d51a932fb6a24ba6fb3b415d6644f065e6146&code=" + automatic_code + "&client_id=c24caca06ff7d9008e0f&grant_type=authorization_code";
    
    //res.send(automatic_code);

    request.post({url:'https://accounts.automatic.com/oauth/access_token', 
      headers: {
        "content-type" : "application/x-www-form-urlencoded"
      },
      body: dataString
    }, 
      function(err,httpResponse,body){

       
        //console.log(httpResponse);
        var jsonbody = JSON.parse(body);
       // console.log(jsonbody);

       console.log(err);
        output(jsonbody,err);
    });

     //res.send("Here is the code I got - " + automatic_code);

  } else {
    // No token, so redirect to login
    res.redirect('/');
  };

  function output(d,err){
    var r_token = d.refresh_token;
    var exp_in = d. expires_in;
    var user_sid = d.user.sid;
    var user_id = d.user.id;
    var a_token = d.access_token;

    var base_url = "http://nomads.stamplayapp.com/#/oauth";

    var compiled_url = base_url + "?" +
    "r_token=" + r_token + "&" +
    "exp_in=" + exp_in + "&" +
    "user_sid=" + user_sid + "&" +
    "user_id=" + user_id + "&" +
    "a_token=" + a_token; 


      res.redirect(compiled_url);
      
    };

});


app.get('/email', (req, res) => {


function buildMap (markers){
  var baseURL = 'https://maps.googleapis.com/maps/api/staticmap?';
  var center = "Denver";
  var zoom = "13";
  var size = "600x343";
  var type = 'roadmap';
  var key = "AIzaSyB3oJKic9ULZQc0duyVqEubBrrlOPS4ktg";
  var marker = "color:blue%7Clabel:S%7C31.74032,-106.32685";

  var encodedPath = "}mx`Ept`hStC|BgEfIXTYf@_B~C}@`BYh@@d@@F@D@Bl@f@FBFBD?D?PCnCkFvDcH`@y@l@kAl@oArD_HvCsF|C{FVe@pCeFrEwIlByDz@}Ap@oA\s@PYZm@JS^s@f@_AlEkIt@qAj@gA|BeEn@iAd@{@HOBG@E?GACHMBCfAiB";
  var path = compilePath(encodedPath);

  var string_new = encodedPath.replace("\\\\", "\\")

  var mapURL = baseURL + "&size=" + size + "&maptype=" + type + markers + "&path=color:0x0000ff|weight:5|" + path + "&key=" + key;
  buildTemplate(mapURL);
};


function compilePath (encodedPath) {
  var ary = polyline.decode(encodedPath);
  var p = ""
  for (var i = 0; i < ary.length; i++) {
    
    p = p + "|" + ary[i][0] + "," + ary[i][1];
  };
  return p
};

var places = [];

function createMarkers () {
  var d = moment().subtract(17, 'days');
  var m = moment().subtract(1, 'days');
  var markerString = "";

  stamplay.Query('object','place')
    .sortAscending("date")
    .exec(function(err, res) {
      //console.log(res);

      var lTracking = 0;
      for (var i = 0; i < res.data.length; i++) {
          var gt = moment().subtract(17, 'days');
          var lt = moment().subtract(1, 'days');


            if (i > 0) {
            //console.log('tried to check');
            var check = checkCoords(res.data[i].coords.latitude, res.data[i].coords.longitude, res.data[i].name);
            if (check == true) {
              var r_earth = 6378;
              var latitude = res.data[i].coords.latitude;
              var longitude = res.data[i].coords.longitude;
              var new_latitude  = latitude  + (0 / r_earth) * (180 / Math.PI);
              var new_longitude = longitude + (8 / r_earth) * (180 / Math.PI) / Math.cos(latitude * Math.PI/180);
              res.data[i].coords.latitude = new_latitude;
              res.data[i].coords.longitude = new_longitude;

            };
          };


          var placeDate = moment(res.data[i].date);
          
            if (placeDate >= gt && placeDate <= lt) {
              var letter = getLetter(lTracking);
              markerString = markerString + "&markers=color:blue|label:" + letter + "|" + res.data[i].coords.latitude + "," + res.data[i].coords.longitude;
              places.push(res.data[i]);
              places[lTracking].let = letter;
              places[lTracking].prettyDate = moment(res.data[i].date).format("MMM Do")
              lTracking = lTracking + 1;
            } else {
         
          }
         
      }

      buildMap(markerString);
    })
};

createMarkers();


function getLetter(x) {
  var letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

  return letters[x];


};

function checkCoords(lat, lon) {
  var c = [];

  for (var i = 0; i < places.length; i++) {
  
    if (places[i].coords.latitude == lat && places[i].coords.longitude == lon) {
      //console.log('this one is true');
     c.push(true);
    } else {
      c.push(false);
    };

  };

   if (c.includes(true)) {
    return true
   } else {
    return false
   };


};

function buildTemplate (map){
  // setup a new mail message
      
      var content;
      var ex;

  // generate the template
  var templateDir = path.join(__dirname, 'templates', 'weekly');
  var newsletter = new EmailTemplate(templateDir);


  var data = {
    username: "weresovancy",
    imgURL: map,
    p: places
   };
  newsletter.render(data, function (err, result) {
       console.log(err);

       ex = result.html;
      // console.log(result.html);
       
            var helper = require('sendgrid').mail;
            var from_email = new helper.Email('jpdean@umich.edu');
            var to_email = new helper.Email('jack@clearestimates.com');
            var subject = 'Hello World from the SendGrid Node.js Library!';
            var content = new helper.Content(
              'text/html', result.html);
             var mail = new helper.Mail(from_email, subject, to_email, content);
            sendCompiledMail(mail, result.html);
  // result.html 
  // result.text 
  });


}; 
   

  function sendCompiledMail (m, c){
    var rq = sg.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: m.toJSON(),
          });

          sg.API(rq, function(error, response) {
            console.log(response.statusCode);
            console.log(response.body);
            console.log(response.headers);
          });
    res.send(c);
};
    

});





// Main page of app with link to log in
app.get('/', (req, res) => {
  res.send('<a href="/auth">Log in with Automatic</a>');
});

// Start server
app.listen(port);

console.log('Express server started on port ' + port);

//below schedules emails to be sent out

// var rule = new schedule.RecurrenceRule();
// rule.minute = [0,15,30,45];
 
// var j = schedule.scheduleJob(rule, function(){
//       console.log('scheduled job ran');

      

//   }); // end schedule.schedule job function

//below schedules emails to be sent out



// var rule = new schedule.RecurrenceRule();
// rule.hour = [9];
 
//   var j = schedule.scheduleJob(rule, function(){
//   var lte = moment().subtract(1, 'minutes').format("x");
//   var gte = moment().subtract(3, 'days').format("x");
//   var fullUrl = "https://api.automatic.com/trip/?started_at__gte=" + gte + "&ended_at__lte=" + lte + "&vehicle=C_410fcc4bbc9a30a5&limit=5";
//   var bearer_token = 'Bearer ' + "1660ee2dbf9614edab00b01bb163c4ef4f7e0300";

//   request.get(
//     {url: fullUrl, 
//       headers: {
//         'Authorization': bearer_token
//       }
//     }, 
//       function(err,httpResponse,body){

//         //console.log(httpResponse);
//         var jsonbody = JSON.parse(body);
//         var lat = jsonbody.results[0].end_location.lat;
//         var lon = jsonbody.results[0].end_location.lon;

//         console.log(lat);
//         createIcon(lat,lon);

//        // console.log(jsonbody);

//         console.log(err);
//     });
      

//   })  ; // end schedule.schedule job function


var rule = new schedule.RecurrenceRule();
rule.hour = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
 
var j = schedule.scheduleJob(rule, function(){
  console.log('A different thing');

    var lte = moment().subtract(1, 'minutes').format("x");
  var gte = moment().subtract(3, 'days').format("x");
  var fullUrl = "https://api.automatic.com/trip/?started_at__gte=" + gte + "&ended_at__lte=" + lte + "&vehicle=C_410fcc4bbc9a30a5&limit=5";
  var bearer_token = 'Bearer ' + "1660ee2dbf9614edab00b01bb163c4ef4f7e0300";

  request.get(
    {url: fullUrl, 
      headers: {
        'Authorization': bearer_token
      }
    }, 
      function(err,httpResponse,body){

        console.log("got a response");
        var jsonbody = JSON.parse(body);
        var lat = jsonbody.results[0].end_location.lat;
        var lon = jsonbody.results[0].end_location.lon;

        //console.log(lat);
        //createIcon(lat,lon);

       // console.log(jsonbody);

        console.log(err);
    });



});



function createIcon (lat, lon) {

    //console.log('got to the create icon function');
    var title = "Sleepy Time of " + moment().subtract(1, "days").format("dddd, MMMM Do YYYY");
    var date = moment();

    var data = {
    "coords": {
      "latitude": lat,
      "longitude": lon
    },
    icon : "images/icons/sleeping.png",
    name: title,
    date: date,
    owner: "58657d99884b37210884b2e5",
    description: ""
  };

  stamplay.Object('place').save(data, function(error, result){
    console.log(error);
    //console.log(result);
});

};






