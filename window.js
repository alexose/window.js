/**
* Window.js
* Version: 0.1.1
* URL:
* Description:
* Requires: jQuery 0.8 +
* Author: Alexander Ose
* Copyright:
* License: MIT
*/

(function ($){
    'use strict';
    var WindowManager;

    $.fn.windowManager = function (options, value, mode){

        // Returns a jQuery collection of elements, or the output from a specified function
        var output,
            elements = this.each(function(){
                if (!$.data(this, 'windowManager')) {
                    $(this).data('windowManger', new WindowManager(this, options));
                } else if (typeof(options) === 'string'){
                    var method = options;
                    output = $(this).data('windowManager')[method](value, mode);
                }
            });

        return output ? output : elements;
    };

    WindowManager = function(el, options){
        var base = this;

        // Access to jQuery and DOM versions of element
        base.$el = $(el);
        base.el  = el;

        // Add a reverse reference to the DOM object
        base.$el.data('windowManager', base);

        base.options = options = $.extend({}, WindowManager.defaults, options);
        base.init();
    };

    WindowManager.defaults = {
        className  : 'wm',
        closeBoxes : true,
        handles : {
            dimensions : [1, 1]
        },
        hooks : {
            onAdd: function(){},
            onRemove : function(){},
            onDrag: function(){}
        }
    };

    WindowManager.prototype.init = function(){
        this.index   = {};
        this.windows = [];
        this.id      = 0;
        this.current = this.$el;

        this
            .initConfig()
            .initRoot()
            .initResizing();

    };

    // Save the current layout in JSON form
    WindowManager.prototype.save = function(){
        var output = {},
            self = this;

        // Determine starting point
        var begin = this.getMain();

        // Traverse windows
        (function traverse(window, obj){
            var ele = window.container;

            obj.options = window.options;

            obj.dimensions = [
                ele.width(),
                ele.height()
            ];

            if (ele.css('float') === 'left'){
                obj.floating = true;
            }

            if (window.children.length){
                obj.children = [];
                window.children.forEach(function(d, i){
                    obj.children.push({});
                    traverse(d, obj.children[i]);
                });
            }
        })(begin, output);

        return JSON.stringify(output);
    };

    // Load JSON configuration
    WindowManager.prototype.load = function(json){
        var config = JSON.parse(json),
            d = config.dimensions,
            scale = [1,1],
            self = this;

        if (d){
            scale = [
                this.$el.width()  / d[0],
                this.$el.height() / d[1]
            ];
        }

        this.root.container.empty();

        (function traverse(parent, obj){
            var d = obj.dimensions,
                children = obj.children,
                element = parent.container,
                type = obj.options.type,
                dimensions = [d[0] * scale[0], d[1] * scale[1]],
                window = new WindowManager.Window(obj.options);

            // Allow exact pixel dimensions
            if (obj.exact && obj.exact === 'width'){
                dimensions[0] = d[0];
            } else if (obj.exact && obj.exact === 'height'){
                dimensions[1] = d[1];
            }

            window.parent = parent;

            window.container
                .appendTo(element)
                .width(dimensions[0])
                .height(dimensions[1]);

            if (obj.floating){
                window.container
                    .css('float', 'left');
            }

            self.addCloseBox(window);

            WindowManager.options.hooks.onAdd(window);

            self.windows.push(window);

            element = window.liner;

            if (children && children.length){
                window.liner.remove();

                window.dimension = children[0].floating ? 'width' : 'height';
                var pos = children[0].floating ? 0 : 1,
                    fixed;

                // Handle pixel-fixed dimensions
                children.forEach(function(d, i){
                    var sibling = i === 0 ? 1 : 0;

                    fixed = fixed || d.options.fixed;

                    // The sibling should occupy the rest of the remaining space
                    if (fixed){
                        children[sibling].dimensions[pos] = dimensions[pos] - d.dimensions[pos];
                    }
                });

                if (fixed){
                    children.forEach(function(d){
                        d.exact = window.dimension;
                    });
                }

                window.children = [
                    traverse(window, children[0]),
                    traverse(window, children[1])
                ];

                if (window.options.divider !== false){
                    window.divider = new WindowManager.Window.Divider(window, true);
                }
            }

            return window;

        }(this.root, config));
    };

    // Create permanent "root" window
    WindowManager.prototype.initRoot = function(){

        if (!this.root){
            var json = WindowManager.options.json,
                silent = json ? true : false;

            this.root = this.add({
                id : this.id++,
                type : 'root',
                permanent : true
            }, null, silent);

            this.root.container
                .height('100%')
                .width('100%');

            this.current = this.root;

            if (json){
                this.load(json);
            }
        }

        return this;
    };

    WindowManager.prototype.initConfig = function(){
        this.$el.addClass(this.options.className);

        WindowManager.options = $.extend({}, WindowManager.defaults, this.options);

        return this;
    };

    WindowManager.prototype.initResizing = function(){
        var self    = this,
            main    = this.getMain().container;

        this.height = main.height();
        this.width  = main.width();

        this.timer  = false;

        $(window).resize(function(){
            if (self.timer !== false){
                clearTimeout(self.timer);
            }
            self.timer = setTimeout($.proxy(self.resize, self), 200);
        });
        return this;
    };

    // Add a window to the window manager
    WindowManager.prototype.add = function(options, target, silent){
        target = target ? target.container : this.current;

        var window = this.append(
                new WindowManager.Window(options),
                target
            );

        // Add close box
        this.addCloseBox(window);

        this.current = window;
        this.windows.push(window);

        if (!silent){
            WindowManager.options.hooks.onAdd(window);
        }

        return window;
    };

    WindowManager.prototype.addCloseBox = function(window){
        var self = this,
            options = window.options;

        if (!options.permanent && this.options.closeBoxes && window.type !== "container"){
            var id = WindowManager.options.className + '-' + window.id;

            window.closeBox = $('<button />')
                .attr('id', id)
                .css({
                    position : 'absolute',
                    top : '4px',
                    right : '5px',
                    'z-index': 999
                })
                .addClass(this.options.className + '-closeBox')
                .addClass('close')
                .attr('type','button')
                .text('x')
                .appendTo(window.container);

            // We use a deferred event handler here, because the button is subject to change location within the DOM.
            this.$el
                .on('click', '#' + id, function(){

                    var container = $(this).parent(),
                        window = container.data('window');

                    if (window){
                        self.remove.call(self, window);
                        WindowManager.options.hooks.onRemove(window);
                    }
                });
        }
    };

    // Return the main container
    WindowManager.prototype.getMain = function(){

        var main = (function(windows){
            for (var i in windows){
                if (windows[i].children.length){
                    return windows[i];
                }
            }
            return windows[0];
        })(this.windows);

        return main;
    };

    // Resize the "desktop"
    WindowManager.prototype.resize = function(){
        var element = this.$el,
            newh = element.height(),
            neww= element.width(),
            h = this.height - newh,
            w = this.width  - neww,
            main = this.getMain();

        main.size(-h, 'height');
        main.size(-w, 'width');

        this.height = newh;
        this.width = neww;
    };

    // Enter edit mode
    WindowManager.prototype.edit = function(type, mode){
        var space = '.create',
            self  = this,
            size, position;

        mode = mode || 'add';

        // Start selection process
        this.windows.forEach(function(d){
            if (
                (mode === 'delete' && d.options && d.options.permanent) ||
                (d.options && d.options.noadd) ||
                (d.children.length > 0)
            ){
                return;
            }

            var container = d.container,
                h = Math.round(container.height() / 2),
                w = Math.round(container.width() / 2),
                aspect = h/w,
                css = {
                    'position': 'absolute',
                    'left' : 0,
                    'right' : 0,
                    'bottom': 0,
                    'top' : 0,
                    'width': 0,
                    'height': 0,
                    'z-index': 10000,
                    'opacity': 0.1,
                    'background': '#000000',
                    'pointer-events': 'none'
                },
                overlay = $('<div />')
                    .addClass(WindowManager.options.className + '-overlay')
                    .css(css);

            // Transparent blocking div to prevent accidental interaction with the element below
            if (!d.block){
              d.block = $('<div />')
                  .addClass('window-block')
                  .css($.extend(css, {
                      'width' : '100%',
                      'height' : '100%',
                      'z-index' : 10001,
                      'background': 'none',
                      'opacity': 'auto',
                      'pointer-events' : 'auto'
                  }))
                  .prependTo(container);
            }

            container
                .unbind(space)
                .bind('mouseenter' + space, function(e){
                    e.stopPropagation();

                    overlay.appendTo(d.block);
                }).bind('mousemove' + space, function(e){
                    e.stopPropagation();

                    if (mode === 'delete') {
                        overlay.css({
                            'width': '100%',
                            'height': '100%'
                        });
                        return;
                    }

                    // Determine which triangle new window belongs in
                    var offset = container.offset(),
                        x = e.clientX - offset.left,
                        y = e.clientY - offset.top,
                        a = x * aspect > y ? true : false,
                        b = (h * 2) - (x * aspect) > y ? true : false;

                    if (a && b){
                        position = 'top';
                        size = y;
                        overlay
                            .width('100%')
                            .height(size)
                            .css({ left : 0, right : 'auto', bottom: 'auto', top : 0 });
                    } else if (a && !b){
                        position = 'right';
                        size = (w * 2) - x;
                        overlay
                            .width(size)
                            .height('100%')
                            .css({ left : 'auto', right : 0, bottom: 'auto', top : 0 });
                    } else if (!a && b){
                        position = 'left';
                        size = x;
                        overlay
                            .width(size)
                            .height('100%')
                            .css({ left : 0, right : 'auto', bottom: 'auto', top : 0 });
                    } else {
                        position = 'bottom';
                        size = (h * 2) - y;
                        overlay
                            .width('100%')
                            .height(size)
                            .css({ left : 0, right : 'auto', bottom: 0, top : 'auto' });
                    }
                }).bind('mouseleave' + space, function(){
                    overlay.remove();
                }).bind('mouseup' + space, function(e){
                    e.stopPropagation();

                    // Remove bindings
                    self.windows.forEach(function(d){
                        d.container.unbind(space);
                        if (d.block){
                            d.block.remove();
                            delete d.block;
                        }
                    });
                    overlay.remove();

                    var options = {
                            id       : self.id++,
                            type     : type,
                            size     : size,
                            position : position
                        };

                    if (mode === 'add'){
                        try {
                            self.add(options, d);
                        } catch (err){
                            console.log('There was a problem adding the window:' + err);
                        }
                    } else if (mode === 'delete'){
                        try {
                            self.remove(d);
                        } catch (error){
                            console.log('There was a problem adding the window:' + error);
                        }
                    }
                });
        });
    };

    // A window is a container made up of either a container and a liner,
    // or a container, two windows, and a divider.
    WindowManager.Window = function(options, liner){
        this.options  = options;
        this.id       = options.id;
        this.type     = options.type || 'default';
        this.children = [];

        // Create frame
        this.container = $('<div />')
            .addClass(WindowManager.options.className + '-' + this.type)
            .css('position', 'relative')
            .css('overflow', 'hidden')
            .data('window', this);

        // Create liner and append it to frame
        this.liner = liner || $('<div />')
            .height('100%')
            .width('100%')
            .appendTo(this.container);

        return this;
    };

    // Add a window to an existing window
    WindowManager.prototype.append = function(window, element){
        var target    = element.data('window'),
            options   = window.options,
            size      = options.size,
            pos       = options.position,
            dimension = (pos === 'top' || pos === 'bottom') ? 'height': 'width',
            action    = (pos === 'left'|| pos === 'top'   ) ? 'prependTo': 'appendTo';

        if (target){

            // Wrap existing liner a new window
            var wrapOptions = $.extend({}, target.options),
                wrap = new WindowManager.Window(wrapOptions, target.liner);

            wrap.id = this.id++;
            target.options.type = 'container';

            delete target.options.id;

            target.liner.replaceWith(wrap.container);
            wrap.container.append(wrap.liner);

            var box = target.closeBox;
            if (target.closeBox){
                wrap.closeBox = target.closeBox;
                target.closeBox.appendTo(wrap.container);
            }

            if (wrap.options.size){
                delete wrap.options.size;
            }
            if (wrap.options.position){
                delete wrap.options.position;
            }

            wrap.container.height(target.container.height());
            wrap.container.width(target.container.width());

            wrap.size(-size, dimension);
            window.size(size, dimension);

            target.container.removeClass(target.type);

            if (dimension === 'width'){
                var style = { float : 'left', height : '100%' };
                wrap.container.css(style);
                window.container.css(style);
            }

            target.dimension = dimension;

            // Add parent & child references
            window.parent = wrap.parent = target;
            target.children = [wrap, window];
            if (action === 'prependTo'){
                target.children = target.children.reverse();
            }
            delete target.liner;

            this.windows.push(wrap);

            // Append (or prepend) DOM element so that the first child appears first in the DOM
            window.container[action](element);

            // Add divider
            target.divider = new WindowManager.Window.Divider(target);

        } else {

            // Append (or prepend) DOM element
            window.container[action](element);
        }


        return window;
    };

    WindowManager.prototype.remove = function(window){
        var parent = window.parent;
        if (parent){

            // Remove window from DOM and unwrap its sibling
            var grandparent = parent.parent,
                children = parent.children,
                sibling = children[0].id === window.id ? children[1] : children[0],
                outer = parent.container,
                inner = sibling.container,
                height = outer.height(),
                width  = outer.width();

            sibling.container.unwrap();
            window.container.remove();

            sibling.parent = grandparent;

            sibling.size(height - inner.height(), 'height');
            sibling.size(width - inner.width(), 'width');

            // Update grandparent children refs
            if (grandparent && grandparent.children.length){
                var g = grandparent,
                    pos = g.children[0].id === parent.id ? 0 : 1;

                g.children[pos] = sibling;
            }

            // Handle floatiness
            var style = { float : grandparent && grandparent.dimension === 'width' ? 'left' : 'none' };
            sibling.container.css(style);

            parent.children = [];

            // Remove divider
            parent.divider.remove();
            delete parent.divider;

            // Move closeBox
            var box = sibling.closeBox;
            if (box){
                box.appendTo(inner);
            }
        }
    };

    // Recursively adjust frame size by pixels.
    WindowManager.Window.prototype.size = function(pixels, dimension){
        var self = this,
            original = getPixels(this, dimension),
            children = this.children;

        if (children.length){

            var fixed = false,
                dims = [];

            children.forEach(function(child, i){
                fixed = child.options.fixed ? i : fixed;
                dims.push(getPixels(child, dimension));
            });


            var total = dims[0] + dims[1],
                ratio = [
                    dims[0] / total,
                    dims[1] / total
                ];

            if (fixed !== false){
                var sibling = 1 - fixed;

                children[sibling].size(pixels, dimension);
            } else {
                children.forEach(function(child, i){
                    var newSize = dimension === self.dimension ? ratio[i] * pixels : pixels;

                    child.size(newSize, dimension);
                });
            }
        }

        if (!this.options.fixed){
            this.container[dimension](original + pixels);
        }

        return this;

        // Return the exact floating-point size of a given window
        function getPixels(window, dimension){
            var element = window.container[0];

            return element.getBoundingClientRect()[dimension];
        }
    };

    // WindowManager.Window.Divider
    // A divider is a div that spans 100% of a window, dividing its two children.
    WindowManager.Window.Divider = function(window, noresize){
        var self = this;

        this.window = window;
        this.resizable = true;
        this.vertical = window.dimension === 'width' ? true : false;
        this.property = this.vertical ? 'clientX' : 'clientY';
        this.position = this.vertical ? 'left' : 'top';
        this.first = window.children[0];
        this.second = window.children[1];
        this.offset = this.first.container[window.dimension]();

        this.bar = $('<div />')
            .addClass('divider');

        if (!noresize){
            this.first
                .size(-5, window.dimension);
        }

        this.first
            .container
            .after(this.bar);

        this.style();

        // Add draggability
        if (this.resizable){
            this.bar
                .mousedown(function(e){ self.startDrag.call(self, e); });
        }

        // Add touch-friendly handles
        if (WindowManager.options.handles){
            var d = WindowManager.options.handles.dimensions;
            if (this.vertical){
                d = d.slice(0).reverse();
            }

            this.bar.append(
                $('<div />')
                .addClass(WindowManager.options.className + '-handle-wrap')
                .css({
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    margin: 'auto',
                    width: 0,
                    height: 0
                }).append(
                    $('<div />')
                    .addClass(WindowManager.options.className + '-handle')
                    .css({
                        position: 'absolute',
                        top : -((d[0])/2),
                        left : -((d[1])/2),
                        height : d[0],
                        width : d[1],
                        background: '#cccccc',
                        //border: '5px solid #cccccc',
                        'z-index': 1
                    })
                )
            );
        }

        return this;
    };

    WindowManager.Window.Divider.prototype.style = function(){
        if (this.vertical){
            this.bar
                .height('100%')
                .width(5)
                .css({'cursor' : this.resizable ? 'col-resize' : 'auto', float : 'left', position: 'relative'});
        } else {
            this.bar
                .width('100%')
                .height(5)
                .css({'cursor' : this.resizable ? 'row-resize' : 'auto', position: 'relative'});
        }

        return this;
    };

    WindowManager.Window.Divider.prototype.remove = function(){
        this.bar.remove();

        return this;
    };

    WindowManager.Window.Divider.prototype.startDrag = function(e){

        // TODO: Let's figure out a less drastic way of preventing selections
        $(document).bind('selectstart dragstart', function(evt) {
            evt.preventDefault();
            return false;
        });

        var self = this,
            bar = this.bar,
            offset = this.offset = this.window.container.offset()[this.position],
            position = e[this.property] - offset;

        // Create overlay
        this.overlay = bar.clone()
            .width( this.vertical ? bar.width()  : bar.innerWidth())
            .height(this.vertical ? bar.height() : bar.innerHeight())
            .css({
                'position': 'absolute',
                'z-index': 999
            })
            .css(this.position, position);

        this.bar.before(this.overlay);

        // Bind mouse events
        this.window.container
            .mousemove(function(e){ self.move.call(self, e); })
            .mouseup(function(e){ self.end.call(self, e); });

    };

    WindowManager.Window.Divider.prototype.move = function(e){
        e.preventDefault();

        this.result = e[this.property] - this.offset;
        this.overlay.css(this.position, this.result);
    };

    WindowManager.Window.Divider.prototype.end = function(){
        $(document).unbind('selectstart dragstart');

        this.bar.css({
            'pointer-events': 'auto'
        });

        var dimension = this.window.dimension,
            children = this.window.children,
            original = children[0].container[dimension](),
            changed = this.result - original;

        // Resize windows
        children[0].size(changed, dimension);
        children[1].size(-changed, dimension);

        // Destroy overlay
        this.overlay.remove();

        // Unbind events
        this.bar.unbind('mousemove');
        this.window.container.unbind('mouseup');

        // Fire onDrag
        WindowManager.options.hooks.onDrag(this.window, changed);
    };

    WindowManager.prototype.destroy = function(){
        $.removeData(this.el, 'windowManager');

        this.$el
            .removeClass(WindowManager.options.className)
            .empty();
    };
})(jQuery);
