var fs = require('fs');
var http = require('http');

var backbone = fs.readFileSync('backbone.js');
var underscore = fs.readFileSync('underscore.js');
var applicationjs = fs.readFileSync('application.js');
var indexhtml = fs.readFileSync('index.html');

var server = http.createServer(function(request, response) {
  var headers = {}
  var body;
  var status = 200;

  switch(request.url){
    case "/":
      headers['Content-Type'] = 'text/html';
      body = indexhtml
      break;
    case "/underscore.js":
      headers['Content-Type'] = 'application/javascript';
      body = underscore;
      break;
    case "/backbone.js":
      headers['Content-Type'] = 'application/javascript';
      body = backbone;
      break;
    case "/application.js":
      headers['Content-Type'] = 'application/javascript';
      body = applicationjs;
      break;
    default:
      body = "";
      status = 404;
  }

  headers['Content-Length'] = body.length;

  response.writeHead(status, headers);

  response.end(body);
});

server.listen(8080, function(){
  console.log("HTTP 1.1 Server started on 8080");
});