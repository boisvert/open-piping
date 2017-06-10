// Set of predefined functions
// predefined functions both define the blocks available to interconnect
// in a graphical interface and the code to use to compile the workflow 

// set of functions available (used by compiler)
var predefined_functions;
// set of replacements - e.g. [plus 1 2] -> 1+2 - (used by compiler)
var predefined_replacements;
// GUI - for the draggable blocks
var predefined_gui;

// position of blockType for the new block being brought in
var oldPos;

// main space for plumbing
var mainPipe;

// start:
// - load the file of predefined functions
// - launch initialisation

jsPlumb.ready(function() {
	// load block GUI
    $.ajax({
        url: "gui.json",
        beforeSend: function(xhr){
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("application/json");
            }
        },
        success: function(json) {
            predefined_gui = json;
            initialise();
        },
        error: function(_, status, err) {debugMsg(status+'\n'+err);}
    });
    // load js
	// This should be handled by the interpreter
    $.ajax({
        url: "js_blocks.json",
        beforeSend: function(xhr){
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("application/json");
            }
        },
        success: function(json) {
            predefined_functions = json.functions;
            predefined_replacements = json.replace;
        },
        error: function(_, status, err) {debugMsg(status+'\n'+err);}
    });
});

var groups = []; // set up UI
var dropIn = null; // where to drop a draggable block
var blockSelection = []; // currently selected block(s)

function initialise() {
    // initialise the GUI list of block types
    var numBlock = 0;
    var args;

	pipeCanvas = $('#pipeContainer');

	mainPipe = new pipeInstance(pipeCanvas);

    for (block in predefined_gui) {

        defGUI = predefined_gui[block];

        if (typeof  (defGUI.group) !== 'undefined') {
        // the block belongs to a group
            debugMsg("found group of"+block);
            var group = defGUI.group;
            if (groups[group]) {
                // if it is not new (pre-existing block)
                // then drop-down should be populated with data about new block
                // in which case numBlock shouldn't be incremented.
                groups[group].push(block);
                // debugMsg();
            } else {
                // if it is a new group, a block should be added that has a drop down,
                // and the first block's name filled
                groups[group]=[block];
            }

            // Can blocks of the same group have a varying number of arguments?

        }
        else {
        // the block is stand-alone
            // position and add the block
            addBlockType(block, numBlock, defGUI ); // was args, as defined above 2017-01-28
            numBlock++;
        }
    }
    debugMsg(groups);

    for (block_group in groups) {
        group = groups[block_group];
        debugMsg(group);

        // work out the GUI for the block
        // to work out the GUI we need to analyse blocks in the group
        
        // position and add the block
        addBlockGroup(block_group, numBlock, group );
        numBlock++;
    }

    // add the 'end' block
    // the endBlock identifies the result of the function
    mainPipe.endBlock();

    // drag and drop blocks
    $( ".blockType" ).draggable({
		cursor: 'move',
		opacity: '0.5',
		zIndex: '2700',
		containment: 'document',
        start: function( event, ui) {
            oldPos = $(this).position();
        }
    });

	pipeCanvas.droppable({
		tolerance: 'pointer',
		drop: function(event,ui) {
			dropping = ui.draggable;
			if (dropping.hasClass('blockType')) {
               mainPipe.addBlock(dropping,ui.position);
               dropping.css(oldPos);
			}
		}
    });

    // delete selected block(s)
    $('html').keyup(function(e){
        if(e.keyCode == 46) {
			debugMsg("removing ",mainPipe.blockSelection.length);
            while (mainPipe.blockSelection.length>0) {mainPipe.removeBlock(mainPipe.blockSelection[0]);}
        }
    });
}

// create block type - ie the source of a function to drag in and use
// position is a css expression of the blockType's position
// inConn is the number of input connections accepted (ie of parameters for function)
// blockHTML is a string giving the HTML to be used to display the block (label by default)
// blockValue - in progress - is a function to use when the block is called ($.text() by default)
function addBlockType(label, position, defGUI) {
    // block is a single
    debugMsg("adding block type",label,defGUI);
    
    var block = $('<div>').attr('id',label).addClass('blockType').html(label);

    if (typeof (defGUI.blockCode) !== 'undefined') {
        $(block).attr('blockCode',defGUI.blockCode);
    }

    if (typeof (defGUI.getExp) !== 'undefined') {
        $(block).attr('getExp',defGUI.getExp);
    }

    var inConn = 2;
    if (typeof (defGUI.args) !== 'undefined') {
        inConn=defGUI.args;
    }

    $(block).attr('inConn',inConn);

    if (position) {
        block.css({top:55*position+20,left:10});
    }

    $('#pipeContainer').append(block);
}

function addBlockGroup(label, position, group) {
    // block is for a group with drop down option

    debugMsg("adding block type",label,group);
    
    var block = $('<div>').attr('id',label).addClass('blockType').html(label);

    var code = "<form><select>";
    for (g in group) {
        code += "<option value="+group[g]+">"+group[g]+"</option>"; // value missing
    }
    code += "</select></form>";
    $(block).attr('blockCode',code);
    
    $(block).attr('getExp',"return block.find('form > select').val();");

    var base = predefined_gui[group[0]]; 
    var inConn = 2;
    if (typeof (base.args) !== 'undefined') {
        inConn=base.args;
    }
    $(block).attr('inConn',inConn);

    if (position) {
        block.css({top:55*position+20,left:10});
    }

    $('#pipeContainer').append(block);
}

// block functions - add, select, deselect, remove, blocktype, endblock - are messy
// project for a rainy day: to group these functions into an encapsulated object
// for clarity and better reusability
function pipeInstance(element) {
	debugMsg("enabling plumbing with ", element.html());
    this.canvas = element; // the document element to attach blocks etc. top
    this.plumber = jsPlumb.getInstance(this.canvas); // the jsPlumb instance, see jsPlumb API for details
    this.idNum = 0; // for generating the ID of blocks in use in this pipe
	this.tokenList = {}; // for generating the list of tokens when 
	this.blockSelection = []; // list of blocks selected for interaction
	this.blockList = []; // all block objects on this pipe

	that = this;
	this.canvas.click(function(e) {
        // If the click was not inside the active span
		debugMsg("click on", $(e.target).html());
        if(!$(e.target).hasClass('blockSelected')) {
    		debugMsg("canvas clicked");
            that.deselectAllBlocks();
        }
    });

}

// addBlock: create a new block of the given type.
// the attributes within blockType provide all the data to customise the block.
// inConn is the number of input connections accepted (ie of parameters for function)

pipeInstance.prototype.addBlock = function (blockType, pos) {
    // this.plumber.recalculateOffsets(b);
    // this.plumber.repaintEverything(); // is it needed?
	debugMsg("Adding a block at position ", pos);
	var b = new blockInstance(blockType, this, pos);
	this.blockList[b.id] = b;
}

pipeInstance.prototype.removeBlock = function(block) {
    this.plumber.detachAllConnections(block.element);
    this.plumber.removeAllEndpoints(block.element);
    this.plumber.detach(block.element);
    this.deselectBlock(block);
	delete this.blockList[block.id];
    block.remove();
}

// create new connector
pipeInstance.prototype.addConnector = function(from,to) {

    // define style of connectors
    var connStyle = {
        anchor:["Bottom","Left"],
        endpoint:"Dot"
    };

    this.plumber.connect({
        source:from,
        target:to
    },
    connStyle); 
}

// the 'endBlock' is the return of the function defined. Unlike others,
// it has no output endpoint; it also can't be removed from the canvas.
// this would be best organised with inheritance. Not done yet.
pipeInstance.prototype.endBlock = function () {
    var blockID = 'end';
    var block = $('<div>').attr('id',blockID).addClass('block').html("End");
/*
	pc = $('#pipeContainer');
	b = $(window).height()-(pc.offset().top+pc.height());
	r = $(window).width()-(pc.offset().left+pc.width());
	debugMsg('endBlock pos: '+b+' '+r);
	debugMsg(pc.offset());
	debugMsg($(window).height());
	debugMsg(pc.height());
*/
    block.css({bottom:10, right:10});

    this.canvas.append(block);

    var common = {
        endpoint:"Dot",
        paintStyle:{ fillStyle:"lightgrey" },
        hoverPaintStyle:{ fillStyle:"lightgreen" },
        connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
        connectorHoverStyle:{strokeStyle:"lightgreen", lineWidth:10 },
        ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
    };

    this.plumber.addEndpoint(blockID, {
        anchors:[0,0.5,-1,0],
        isTarget: true,
        maxConnections: 1
    }, common);

	var that = this;
    $(block).click(function() {
         blockSelection = [];
         that.displayExpression(blockID);
    });
}

// Given a block, traverse the tree that ends with that block
// And return the corresponding s-expression
pipeInstance.prototype.getExpression = function (blockID) {
	debugMsg("finding expression from",blockID);
	var block = this.blockList[blockID];
    var connections = this.plumber.getConnections({ target:blockID });
	debugMsg(connections.length, "connections found");
    var op;
    if (connections.length>0) {
        if (blockID==='end') {
            op = this.getExpression(connections[0].sourceId);        
        }
        else {
            var exp = block.getExpression();
            if (exp == "setq") {
                if (!this.tokenList[blockID]) {
                    op = [exp,blockID];
                    for (var i =0; i<connections.length; i++) {
                        // alert(blockID+' '+i+' '+JSON.stringify(result));
                        op[i+2] = this.getExpression(connections[i].sourceId);
                    }
                    this.tokenList[blockID] = op;
                    // alert(JSON.stringify(this.tokenList));
                }
                op = blockID;
            }
            else {
                op = [exp];
                for (var i =0; i<connections.length; i++) {
                    // alert(blockID+' '+i+' '+JSON.stringify(result));
                    op[i+1] = this.getExpression(connections[i].sourceId);
                }
            }
        }
    }
    else {
        op = block.getExpression();
    }
    debugMsg("Got expression", op);
    return op; 
}

// output function to view the expression for a block
pipeInstance.prototype.displayExpression = function (blockID) {
    this.tokenList = {};
    var exp = this.getExpression(blockID);
    // alert(JSON.stringify(this.tokenList));
    if (Object.keys(this.tokenList).length === 0) {
        debugMsg("No tokens");
        result = exp;
    } else {
        debugMsg("Some tokens");
        var result = [];
        for (var i in this.tokenList) {
            result.push(this.tokenList[i]);
        }
        result.push(exp);
    }
    $('#s-exp').val(JSON.stringify(result));
}

// Generate a unique ID for each block in this pipe
pipeInstance.prototype.nextID = function () {
	var result = 'id'+this.idNum;
    this.idNum++;
    return result;	
}

pipeInstance.prototype.selectBlock = function (block) {
    debugMsg("selecting block",block.id);
    this.blockSelection.push(block);
}

pipeInstance.prototype.deselectBlock = function (block) {
	debugMsg("Deselecting block",block.id);
    var index = this.blockSelection.indexOf(block);
    if (index > -1) {
        this.blockSelection.splice(index, 1);
        block.deselect(this);
    }
}

pipeInstance.prototype.deselectAllBlocks = function() {
	debugMsg("Deselecting all blocks");
	while (this.blockSelection.length>0)
		this.deselectBlock(this.blockSelection[0]);
}

function blockInstance(type, pipe, pos) {

    this.type = type; // blockType element - contains a lot of data
	this.pipe = undefined; // pipe (when the block is added)
	this.id = ''; // ID of block (when the block is added)
    this.expression = undefined;

    this.element = $('<div>').addClass('block').attr('label',this.label());

	this.setHTML();

	this.setPipe(pipe, pos);

}

blockInstance.prototype.setPipe = function(pipe,pos) {
	this.pipe = pipe;
    this.id = pipe.nextID();
    this.element.attr('id',this.id);
    this.expression = 
	
    pipe.canvas.append(this.element);

	this.setPosition(pos);

    var common = {
        endpoint:"Dot",
        paintStyle:{ fillStyle:"lightgrey" },
        hoverPaintStyle:{ fillStyle:"lightgreen" },
        connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
        connectorHoverStyle:{ strokeStyle:"lightgreen", lineWidth:10 },
        ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
    };

    var endProps;
    if (this.label() == "setq") {
		debugMsg("setq, using -1 connection limit");
    	endProps = {anchor:[1,0.5,1,0], isSource: true, maxConnections: -1};
    } else {
        endProps = {anchor:[1,0.5,1,0], isSource: true}
    }

	debugMsg("Adding block output");
    pipe.plumber.addEndpoint(this.id, endProps, common);

    // check if input connections are required for this block
	var inConn = this.inConnections();
    if (inConn) {
        // add input connections
		debugMsg("There are ",inConn," inputs");
        var pos;
        var ct;
        for (ct=0; ct<inConn; ct++) {
            pos = 0.1+ct/3.5
            pipe.plumber.addEndpoint(this.id, {
                anchors:[[pos, 0, 0, 1]],
                isTarget: true,
                maxConnections: 1
            }, common);
        }
    }

	pipe.plumber.draggable(this.element, {containment: 'parent'});

	var that = this;
	this.element.click(function() {
		that.pipe.deselectAllBlocks();
        that.select();
        that.pipe.displayExpression(that.id);
    });
}

blockInstance.prototype.setPosition = function(pos) {
    this.element.css(pos);
}

blockInstance.prototype.setHTML = function() {
    var inHTML = this.label();

    if (typeof (this.type.attr("blockCode")) !== 'undefined') {
        inHTML += '<br />'+this.type.attr("blockCode");
    }
	
	this.element.html(inHTML);
}

blockInstance.prototype.getExpression = function() {

    var result;
	var getExp = this.type.attr("getExp");
    var label = this.label();
	
    if (typeof (getExp) !== 'undefined') {
		debugMsg('found getExp string ',getExp);
		var block = this.element;
        eval("result = function () {"+getExp+"};"); // JavaScript is a strange animal sometimes...
    }
    else {
        result = function() {return label;};
    }

    return result();
}

// get block label
blockInstance.prototype.label = function() {
    return this.type.attr("id");
}

// get number of accepted input connections for the block
blockInstance.prototype.inConnections = function() {
	 return this.type.attr("inConn");
}

// selecting is initiated by the block
blockInstance.prototype.select = function () {
	this.pipe.selectBlock(this);
    this.element.addClass("blockSelected");
}

// deselecting is initiated by the pipe that 'owns' the block
blockInstance.prototype.deselect = function () {
    this.element.removeClass("blockSelected");
}

blockInstance.prototype.remove = function () {
    this.element.remove();
}

function blockEditor(label) {
    this.editor = $('<div>').attr('id',label).attr('title','Edit block');
	var form = $('<form>').
	           append('Block:').
			   append('<input type="text" value="'+label+'" size=5 />').
			   append(' Arguments:');

	var argsinput = $('<input>').attr('id', label+'args').attr('type','text').attr('size',5);
	form.append(argsinput);

	// want a spinner instead of argsinput but - not showing
	// var spinner = $('<input>').attr('id', label+'args').attr('size',5).spinner();
	// form.append(spinner);

    this.editor.append(form).append('<br />');
    
	var encoreunediv = $('<div>');

    this.editor.dialog();
	debugMsg("making block editor");
	this.blockPipe = new pipeInstance(this.editor);

	that = this;
	this.editor.droppable({
		tolerance: 'pointer',
		over: function(event, ui) {
			mainPipe.canvas.droppable('disable');
		},
		out: function(event, ui) {
			mainPipe.canvas.droppable('enable');
		},
		drop: function(event,ui) {
			dropping = ui.draggable;
			if (dropping.hasClass('blockType')) {
				edPos = that.editor.offset();
				t = ui.offset.top-edPos.top;
				l = ui.offset.left-edPos.left;
                that.blockPipe.addBlock(dropping,{top:t, left:l},that.editor);
                dropping.css(oldPos);
    			mainPipe.canvas.droppable('enable');
            }
        }
    });

}

/*
// token generation
// not good
var token = {
    tokenRoots: {},
    getNext: function(root) {
        if (!root) root = "token";
        var next = 0;
        if (token.tokenRoots[root])
            next = ++token.tokenRoots[root]
        else
            token.tokenRoots[root] = next;
    }
};
*/

