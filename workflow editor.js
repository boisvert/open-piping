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

// blockEditor object
var bE;

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
                groups[group]=[defGUI,block];
            }
		}
        else {
        // the block is stand-alone
            // position and add the block
            mainPipe.addBlockType(block, defGUI, numBlock ); // was args, as defined above 2017-01-28
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
        mainPipe.addBlockGroup(block_group, group, numBlock );
        numBlock++;
    }

    // add the 'end' block
    // the endBlock identifies the result of the function
    mainPipe.endBlock();

	pipeCanvas.droppable({
		tolerance: 'pointer',
		drop: function(event,ui) {
			dropping = ui.draggable;
			if (dropping.hasClass('blockType')) {
               mainPipe.addBlock(dropping,ui.position);
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

// block functions - add, select, deselect, remove, blocktype, endblock - are messy
function pipeInstance(element) {
	debugMsg("enabling plumbing with ", element.html());
    this.canvas = element; // the document element to attach blocks etc. top
    this.plumber = jsPlumb.getInstance(this.canvas); // the jsPlumb instance, see jsPlumb API for details
    this.idNum = 0; // for generating the ID of blocks in use in this pipe
	this.tokenList = {}; // for generating the list of tokens when 
	this.blockSelection = []; // list of blocks selected for interaction
	this.blockList = []; // all block objects on this pipe
	this.blockTypeList = []; // all block types available to drag

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

// create block type - ie the source of a function to drag in and use
// position is a css expression of the blockType's position
// inConn is the number of input connections accepted (ie of parameters for function)
// blockHTML is a string giving the HTML to be used to display the block (label by default)
// blockValue - in progress - is a function to use when the block is called ($.text() by default)
pipeInstance.prototype.addBlockType = function(label, defGUI, position) {
    var bT = new blockType(label, defGUI);
    bT.setPos(position);
	this.blockTypeList[label] = bT;
    this.canvas.append(bT.element);
}

pipeInstance.prototype.addBlockGroup = function (label, group, position) {
    // block is for a group with drop down option
	debugMsg("adding group ", group);

	// the first item in the group contains the GUI
	// (that works for dropCode, inConn, outConn)
	var defGUI = group[0];
	// the rest is the list of grouped blocks
	group = group.slice(1);
    defGUI.getExp = "return block.find('form > select').val();";

    defGUI.blockCode = "<form><select>";
    for (g in group) {
        defGUI.blockCode += "<option value="+group[g]+">"+group[g]+"</option>";
    }
    defGUI.blockCode += "</select></form>";

	this.addBlockType(label,defGUI,position);

/*
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

    this.canvas.append(block);
*/
}

// addBlock: create a new block of the given type.
// the attributes within blockType provide all the data to customise the block.
// inConn is the number of input connections accepted (ie of parameters for function)
pipeInstance.prototype.addBlock = function (blockType, pos) {
	debugMsg("Adding a block at position ", pos);
    var realType = this.blockTypeList[blockType.attr('id')];
	if (!realType) {
		realType = mainPipe.blockTypeList[blockType.attr('id')];
	}
	var b = new blockInstance(realType, this, pos);
	this.blockList[b.id] = b;
	realType.moveBack();
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
	this.blockList[blockID] = block;

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

    this.plumber.addEndpoint(block, {
        anchors:[0,0.5,-1,0],
        isTarget: true,
        maxConnections: 1
    }, common);

	var that = this;
    $(block).click(function(e) {
         that.blockSelection = [];
         that.displayExpression(blockID);
		 e.stopPropagation();
    });
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

pipeInstance.prototype.getExpression = function (blockID) {
    block = this.blockList[blockID];	
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
		if (blockID!=='end') {
            op = block.getExpression();
		}
    }
    debugMsg("Got expression", op);
    return op; 
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

function blockType(label, defGUI) {

    debugMsg("new block ",label,defGUI);

	var block = $('<div>').attr('id',label).addClass('blockType').html(label);
    this.element = block;
    this.blockCode = defGUI.blockCode;
    this.getExp = defGUI.getExp;
    this.dropCode = defGUI.dropCode;
    this.inConn = (defGUI.args==='undefined')?2:defGUI.args;
    this.outConn = (defGUI.output==='undefined')?1:defGUI.output;

	// drag block
    block.draggable({
		cursor: 'move',
		opacity: '0.5',
		zIndex: '2700',
		containment: 'document'
	});

}

blockType.prototype.setPos = function(position) {
    if (position) {
        this.pos = {top:55*position+20,left:10};
	    this.moveBack();
    } else
		this.pos = this.element.position();
}

blockType.prototype.moveBack = function() {
    if (this.pos) {
        this.element.css(this.pos);
    }
}

function blockInstance(type, pipe, pos) {

	debugMsg("new block",type);
    this.type = type; // blockType element - contains a lot of data
	this.pipe = undefined; // pipe (when the block is added)
	this.id = undefined; // ID of block (when the block is added)

    this.element = $('<div>').addClass('block').attr('label',this.label());

	this.setHTML();

	this.setPipe(pipe, pos);

}

blockInstance.prototype.setPipe = function(pipe,pos) {
	this.pipe = pipe;
    this.id = pipe.nextID();
    this.element.attr('id',this.id);

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
    if (this.outConnections() == -1) {
		debugMsg("using -1 connection limit");
    	endProps = {anchor:[1,0.5,1,0], isSource: true, maxConnections: -1};
    } else {
        endProps = {anchor:[1,0.5,1,0], isSource: true};
    }

	debugMsg("Adding block output");
    pipe.plumber.addEndpoint(this.element, endProps, common);

    // check if input connections are required for this block
	var inConn = this.inConnections();
    if (inConn) {
        // add input connections
		debugMsg("There are ",inConn," inputs");
        var pos;
        var ct;
        for (ct=0; ct<inConn; ct++) {
            pos = 0.1+ct/3.5
            pipe.plumber.addEndpoint(this.element, {
                anchors:[[pos, 0, 0, 1]],
                isTarget: true,
                maxConnections: 1
            }, common);
        }
    }

	var dropCode = this.dropCode();
	if (dropCode != undefined) {
		debugMsg('running dropcode', dropCode);
		var block = this.element;
		eval(dropCode);
    }

	pipe.plumber.draggable(this.element, {containment: 'parent'});

	var that = this;
	this.element.click(function(e) {
		that.pipe.deselectAllBlocks();
        that.select();
        that.pipe.displayExpression(that.id);
		e.stopPropagation();
    });

}

blockInstance.prototype.setPosition = function(pos) {
    this.element.css(pos);
}

blockInstance.prototype.setHTML = function() {
    var inHTML = this.label();

    if (typeof (this.type.blockCode) !== 'undefined') {
        inHTML += '<br />'+this.type.blockCode
	}
	
	this.element.html(inHTML);
}

blockInstance.prototype.getExpression = function() {

    var resultFn;

	var getExp = this.type.getExp;
    if (typeof (getExp) !== 'undefined') {
		debugMsg('found getExp string ', getExp);
		var block = this.element;
        eval("resultFn = function () {"+getExp+"};"); // JavaScript is a strange animal sometimes...
    }
    else {
		var label = this.label();
		resultFn = function() {return label;};
    }

    return resultFn();

}

// get block label
blockInstance.prototype.label = function() {
    return this.type.element.attr("id");
}

// get block dropCode 
blockInstance.prototype.dropCode = function() {
    return this.type.dropCode;
}

// get number of accepted input connections for the block
blockInstance.prototype.inConnections = function() {
	 return parseInt(this.type.inConn);
}

blockInstance.prototype.outConnections = function() {
	 return this.type.outConn;
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

function editBlock() {
   bE = new blockEditor('test');
   $('#createNewBlock').attr('disabled','disabled');
}

function blockEditor(label) {
    this.editor = $('<div>').attr('id',label).attr('title','Edit block');
	this.argIndex = 0;
	var form = $('<form>').
	           append('Block:').
			   append('<input type="text" size=5 />');

    this.editor.append(form);

    this.editor.dialog({width: 560, height:420});

	debugMsg("making block editor");
	this.pipe = new pipeInstance(this.editor);

	var argType = {};
	argType.args = 0;
	argType.blockCode = "<form><input type='text' size=3/><form>";
	argType.dropCode ="var inpt = block.find('form > input')[0]; inpt.value = bE.nextArgID();";
	argType.getExp = "var inpt = block.find('form > input')[0]; return inpt.value;";
	argType.output = -1; // number of output connections is illimited
    this.pipe.addBlockType('Argument',argType,{top:100, left:100});
	this.pipe.endBlock();

	that = this;
	this.editor.on('dialogclose', function(ev) {
        $('#createNewBlock').removeAttr('disabled','disabled');
		var ex = that.pipe.getExpression('end');
		if (ex != undefined) {
    		// alert(ex);
		}
    });

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
                that.pipe.addBlock(dropping,{top:t, left:l});
    			mainPipe.canvas.droppable('enable');
            }
        }
    });

	return this;
}

blockEditor.prototype.nextArgID = function() {
	this.argIndex++;
	return 'arg'+this.argIndex;
}

