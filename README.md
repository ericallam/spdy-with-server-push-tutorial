Ilya Grigorik gave a great talk recently ostensibly titled [HTTP 2.0 For Fun and Profit](https://www.youtube.com/watch?feature=player_embedded&v=ZxfEcqJ4MOM), even though he actually talks mostly about [SPDY](http://www.chromium.org/spdy), the next generation web protocol developed at Google that the HTTP 2.0 Working Group is using as it's starting point/sandbox for new ideas. 

SPDY is a game-changer.  It's going to change how web developers deliver content to the browser.  No longer will we have to resort to [hacks](http://guides.rubyonrails.org/asset_pipeline.html), building concatenated JS and CSS files, splitting up resources into different [asset hosts](http://scottpatten.ca/2007/10/setting-up-multiple-asset-hosts-in-rails.html) to trick the browser into downloading more assets at once. We are going to have to rethink all of the assumptions we currently are making. 

So to get prepared, I built my very first SPDY app using node.js and the `spdy` module and I'm going to walk you through doing the same thing. 

First, here is the node.js app before spdy:

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

Here I created an `http` server using [createServer](http://nodejs.org/api/http.html#http_http_createserver_requestlistener) and gave it a request handler callback. Every time a new request hits this server it will invoke the callback, passing in a [request](http://nodejs.org/api/http.html#http_class_http_serverrequest) and [response](http://nodejs.org/api/http.html#http_class_http_serverresponse) object. I then write a little code to handle different URLs. I'm serving up four things: an HTML file at the root path, `underscore.js`, `backbone.js`, and my `application.js`. Here is the `index.html` file:

    <html>
      <head>
        <title>Boring HTTP 1.1 App</title>
        <script src='/underscore.js' type="text/javascript"></script>
        <script src='/backbone.js' type="text/javascript"></script>
        <script src='/application.js' type="text/javascript"></script>
      </head>
      <body>
        <h1>Served with HTTP 1.1</h1>
      </body>
    </html>

Now I can start my server with node and go to `localhost:8080` in Chrome.

![http11](http://f.cl.ly/items/3E1y3p3J433U0j0O0T3H/Image%202013.02.02%207:10:09%20AM.png)

Notice that little grayed-out lightning icon in the Chrome omnibox. That's a little extension called the [Chrome SPDY Indicator](https://chrome.google.com/webstore/detail/spdy-indicator/mpbpobfflnpcgagjijhmgnchggcjblin?hl=en).  Install it and it will light up green whenever you visit site that uses SPDY (go ahead and install it and try it out on google.com or twitter.com). 

Our goal is to make that lightning bolt go green.

To do that we first have to `npm install spdy` to install [node-spdy](https://github.com/indutny/node-spdy), a great little node module for writing spdy servers. The next part is a little dull but stay with me, we'll get to the good stuff in about 3 minutes.  But first, we need to generate a [Self-Signed Certificate](http://en.wikipedia.org/wiki/Self-signed_certificate) because SPDY only works over SSL.  Luckily, if you are on *OS X*, it is pretty simple.  In your node app, run these commands in your terminal (or just follow along with [this tutorial](https://devcenter.heroku.com/articles/ssl-certificate-self):

    spdy-js $ mkdir keys
    spdy-js $ openssl genrsa -des3 -out keys/server.orig.key 2048
    spdy-js $ openssl req -new -key keys/server.key -out keys/server.csr
    spdy-js $ openssl x509 -req -days 365 -in keys/server.csr -signkey keys/server.key -out keys/server.crt

Okay, that wasn't so bad. Now back to our node app. Let's walk through this.

First, we require the `spdy` module instead of our `http` module:

    var fs = require('fs');
    var spdy = require('spdy');

The `spdy` replaces but still uses the `http` module for fallback on browsers that don't support SPDY. 

Next up we just load our js files and our certificate files we just generated:

    var backbone = fs.readFileSync('backbone.js');
    var underscore = fs.readFileSync('underscore.js');
    var applicationjs = fs.readFileSync('application.js');
    
    var options = {
      key: fs.readFileSync('newkeys/server.key'),
      cert: fs.readFileSync('newkeys/server.crt'),
      ca: fs.readFileSync('newkeys/server.csr')
    };

Now we create a `spdy` server, passing in our certificate options and a request handler:

    var server = spdy.createServer(options, function(request, response) {

Next, we'll talk advantage of an awesome SPDY feature called [server push](http://www.chromium.org/spdy/spdy-protocol/spdy-protocol-draft3#TOC-3.3-Server-Push-Transactions) to "push" our asset files to the client along with our HTML response. The client will act like the pushed asset files were already in it's cache, so it doesn't have to make separate requests for our asset files and instead can immediately start interpreting them.

With `spdy`, all we have to do is call `push` on the `response` for each file, like so:

      var headers = {
        'content-type': 'application/javascript'
      }
    
      response.push('/backbone.js', headers, function(err, stream){
        if (err) return;
    
        stream.end(backbone);
      });
      response.push('/underscore.js', headers, function(err, stream){
        if (err) return;
    
        stream.end(underscore);
      });
      response.push('/application.js', headers, function(err, stream){
        if (err) return;
    
        stream.end(applicationjs);
      });

Now we can finish up by responding with some HTML and using the `request.isSpdy` property to respond with a happy message of triumph if the client is SPDY capable:

    response.writeHead(200, {'content-type': 'text/html'});
      var message = "No SPDY for you!"
      if (request.isSpdy){
        message = "YAY! SPDY Works!"
      }
      response.end("" +
        "<html>" + 
          "<head>" +
            "<title>First SPDY App!</title>" +
            "<script src='/underscore.js'></script>" +
            "<script src='/backbone.js'></script>" +
            "<script src='/application.js'></script>" +
          "<head>" +
          "<body>" +
            "<h1>" + message + "</h1>" +
          "</body>" +
        "<html>");

After calling `server.listen(8081)`, we can open up Chrome to `https://localhost:8081`:

![SPDY WORKS](http://f.cl.ly/items/0D2l3H0j063d3H2h3n2T/Image%202013.02.02%207:39:41%20AM.png)

Notice how Chrome reports our assets as being served from the cache. That is server push at work:

![SERVER PUSH](http://f.cl.ly/items/1k1I1I3F3C3Y1t1M203c/Image%202013.02.02%207:39:13%20AM.png)

