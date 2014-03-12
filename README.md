Window.js
=========

A tiling window manager for your web page.

Window.js is a tool for laying out dashboards, editors, and visualizations in a snap.  It's particularly useful when dealing with reusable charts, as it allows a users to rearrange and resize elements on their own.

[Live demo](http://alexose.github.io/window.js)

## Quickstart

Include jquery, window.js and window.css in your page source:

    <script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
    <script src="//alexose.github.io/window.js/window.js"></script>
    <link type="text/css" rel="stylesheet" href="//alexose.github.io/window.js/window.css">

Then call it:

    <script>$('#example').windowManager();</script>

## Features

### Events

Window.js exposes events for adding, removing, and resizing.  It's easy to hook into these events:

    $('#example').windowManager({
        hooks : {
            onAdd:    doSomething,
            onRemove: doSomething,
            onDrag:   doSomething
        }
    });

    function doSomething(obj){
        console.log('Something happened!');
        console.log(obj);
    }

### Saving

Window.js can save its configuation as JSON at any time.  This makes it possible for users to save preferred layouts for later:

    var json = $('#example').windowManager('save');

### Loading

Loading the above JSON is easy:

    $('#example').windowManager('load', json);

It might also be useful to load a particular layout on page load.  You can simply pass in the above JSON string as an argument:

    $('#example').windowManager({
        json : json
    });
