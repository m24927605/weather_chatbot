'use strict';
const PAGE_ACCESS_TOKEN = 'EAAXHMuYrhNkBANI47YHnLlk3cRKZBvuMp8yBZAOxo0E9IKWAwvxWZA1AZAz1ZAhZAFyQ6TmWZAmcnpqQioz16bl5OlcDCxrbXdmrTPYAu5ZAKZCihtDHGx2JSHrn2R1B2XFFDlBoORP4oxAryPcqX70AnZC6jOhmLsXMSVDTAZC8tYjDE9FyNAoabLX';
const APIAI_TOKEN = '8d04cf083486446dbe474e96694a817a';
const WEATHER_API_KEY = '825292a15a0d7c118b8d3d7e336d65d8';

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');
const request = require('request');
const apiai = require('apiai');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});

const apiaiApp = apiai(APIAI_TOKEN);

/* For Facebook Validation */
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] && req.query['hub.verify_token'] === 'tuxedo_cat') {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.status(403).end();
  }
});

/* Handling all messenges */
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message && event.message.text) {
          receivedMessage(event);
        }
      });
    });
    res.status(200).end();
  }
});

/* GET query from API.ai */

function receivedMessage(event) {
  let sender = event.sender.id;
  let text = event.message.text;

  let apiai = apiaiApp.textRequest(text, {
    sessionId: 'tabby_cat'
  });

  apiai.on('response', (response) => {
    let aiText = response.result.fulfillment.speech;
    console.log(aiText);

    switch (aiText) {
      case 'SHOW_BIOGRAPHY':
        prepareSendBio(sender);
        break;

      default:
        prepareSendAiMessage(sender, aiText);
    }

  });

  apiai.on('error', (error) => {
    console.log(error);
  });

  apiai.end();
}

function sendMessage(messageData) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: PAGE_ACCESS_TOKEN
    },
    method: 'POST',
    json: messageData
  }, (error, response) => {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

function prepareSendAiMessage(sender, aiText) {
  let messageData = {
    recipient: {
      id: sender
    },
    message: {
      text: aiText
    }
  };
  sendMessage(messageData);
}

function prepareSendBio(sender) {
  let messageData = {
    recipient: {
      id: sender
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [{
            title: 'Twitter',
            subtitle: '@girlie_mac',
            item_url: 'https://www.twitter.com/girlie_mac',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-twitter.png',
            buttons: [{
              type: 'web_url',
              url: 'https://www.twitter.com/girlie_mac',
              title: 'View Twitter Bio'
            }],
          }, {
            title: 'Work History',
            subtitle: 'Tomomi\'s LinkedIn',
            item_url: 'https://www.linkedin.com/in/tomomi',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-linkedin.png',
            buttons: [{
              type: 'web_url',
              url: 'https://www.linkedin.com/in/tomomi',
              title: 'View LinkedIn'
            }]
          }, {
            title: 'GitHub Repo',
            subtitle: 'girliemac',
            item_url: 'https://github.com/girliemac',
            image_url: 'https://raw.githubusercontent.com/girliemac/fb-apiai-bot-demo/master/public/images/tomomi-github.png',
            buttons: [{
              type: 'web_url',
              url: 'https://github.com/girliemac',
              title: 'View GitHub Repo'
            }]
          }]
        }
      }
    }
  };
  sendMessage(messageData);
}

/* Webhook for API.ai to get response from the 3rd party API */
app.post('/ai', (req, res) => {
  console.log('*** Webhook for api.ai query ***');
  console.log(req.body);

  if (req.body.queryResult.action === 'weather') {
    console.log('*** weather ***');
    let city = req.body.queryResult.parameters['geo-city'];
    let restUrl = 'http://api.openweathermap.org/data/2.5/weather?APPID=' + WEATHER_API_KEY + '&q=' + city;

    request.get(restUrl, (err, response, body) => {
      if (!err && response.statusCode == 200) {
        let json = JSON.parse(body);
        console.log('====json====', json);
        let tempF = ~~(json.main.temp * 9 / 5 - 459.67);
        let tempC = ~~(json.main.temp - 273.15);
        let msg = 'The current condition in ' + json.name + ' is ' + json.weather[0].description + ' and the temperature is ' + tempF + ' ℉ (' + tempC + ' ℃).'
        return res.json({
          fulfillmentText: msg,
          source: 'weather'
        });
      } else {
        let errorMessage = 'I failed to look up the city name.';
        return res.status(400).json({
          status: {
            code: 400,
            errorType: errorMessage
          }
        });
      }
    })
  }

});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

