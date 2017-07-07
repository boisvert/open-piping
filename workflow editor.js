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

// which pipe (main or blockeditor) has the focus
var focusPipe;

// config information
var config = {
	connectStyle:{
        endpoint:"Dot",
        paintStyle:{ fillStyle:"lightgrey" },
        hoverPaintStyle:{ fillStyle:"lightgreen" },
        connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
        connectorHoverStyle:{ strokeStyle:"lightgreen", lineWidth:10 },
        ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
    }
}

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
	focusPipe = mainPipe; // main is in focus by default

    for (block in predefined_gui) {

        defGUI = predefined_gui[block];

        if (typeof  (defGUI.group) !== 'undefined') {
        // the block belongs to a group
            debugMsg("found group of ", block.id);
            var group = defGUI.group;
            if (groups[group]) {
                // if it is not new (pre-existing block)
                // then drop-down should be populated with data about new block
                // in which case numBlock shouldn't be incremented.
                groups[group].push(block);
            } else {
                // if it is a new group, a block should be added that has a drop down,
                // for that the first block's name filled
                groups[group]=[defGUI,block];
            }
		}
        else {
        // the block is stand-alone
            // position and add the block
            mainPipe.addBlockType(new blockType(block, defGUI), numBlock ); // was args, as defined above 2017-01-28
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
    mainPipe.addEndBlock();

	pipeCanvas.droppable({
		tolerance: 'pointer',
		drop: function(event,ui) {
			dropped = ui.draggable;
			if (dropped.hasClass('blockType')) {
               mainPipe.addBlock(dropped,ui.position);
			}
		}
    });

    // delete selected block(s)
    $('html').keyup(function(e){
        if(e.keyCode == 46) {
			focusPipe.deleteSelectedBlocks();
        }
    });

}

// block functions - add, select, deselect, remove, blocktype, endblock - are messy
function pipeInstance(element) {
	debugMsg("enabling plumbing	");
    this.canvas = element; // the document element to attach blocks etc. top
    this.plumber = jsPlumb.getInstance(this.canvas); // the jsPlumb instance, see jsPlumb API for details
    this.idNum = 0; // for generating the ID of blocks in use in this pipe
	this.tokenList = {}; // for generating the list of tokens when 
	this.blockSelection = []; // list of blocks selected for interaction
	this.blockList = {}; // all block objects on this pipe
	this.blockTypeList = {}; // all block types available to drag

	that = this;
	this.canvas.click(function(e) {
        // If the click was not inside the active span
		debugMsg("click");
        if(!$(e.target).hasClass('blockSelected')) {
    		debugMsg("canvas clicked");
            that.deselectAllBlocks();
			e.stopPropagation();
        }
    });
}

pipeInstance.prototype.addBlockType = function(blockType, position) {
    blockType.addTo(this,position);
}

pipeInstance.prototype.removeBlockType = function(label) {
    var bT = this.blockTypeList[label];
    this.canvas.remove(bT.element);
	delete this.blockTypeList[label];
}

pipeInstance.prototype.addBlockGroup = function (label, groupData, position) {
    // block is for a group with drop down option
	debugMsg("adding group ", groupData);

	// the first item in the group contains the GUI
	// (that works for dropCode, inConn, outConn)
	var defGUI = groupData[0];
	// the rest is the list of grouped blocks
	group = groupData.slice(1);
    defGUI.getExp = "return block.find('form > select').val();";

    defGUI.blockCode = "<form><select>";
    for (g in group) {
        defGUI.blockCode += "<option value="+group[g]+">"+group[g]+"</option>";
    }
    defGUI.blockCode += "</select></form>";

	this.addBlockType(new blockType(label, defGUI),position);

}

// addBlock: create a new block of the given type.
// the attributes within blockType provide all the data to customise the block.
// inConn is the number of input connections accepted (ie of parameters for function)
pipeInstance.prototype.addBlock = function (blockType, pos) {
	debugMsg("Adding a block at position ", pos, " of type ", blockType.html() );
    var realType = this.blockTypeList[blockType.html()];
	if (!realType) {
		realType = mainPipe.blockTypeList[blockType.html()];
	}
	realType.moveBack();
	var b = new blockInstance(realType, this, pos);
	this.blockList[b.id] = b;
}

pipeInstance.prototype.removeBlock = function(block) {
	var ok = true;
	if (focusPipe != mainPipe) {
		if (bE.userBlock.findArgument(block)) {
			debugMsg("the block is an argument");
			ok = bE.userBlock.deleteArgument(block);
		}
	}
	if (ok) {
		this.plumber.detachAllConnections(block.element);
		this.plumber.removeAllEndpoints(block.element);
		this.plumber.detach(block.element);
		this.deselectBlock(block);
		delete this.blockList[block.id];
		block.remove();
	}
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

// adding the 'endBlock'. Unlike others,
// it has no output endpoint; it also can't be removed from the canvas.
// this would be best organised with inheritance. Not done yet.
pipeInstance.prototype.addEndBlock = function () {
    var blockID = 'end';
    var block = $('<div>').attr('id',blockID).addClass('block').html("End");
	this.blockList[blockID] = this;
	this.type = {id: 'end'};

    this.canvas.append(block);
    block.css({bottom:10, right:10});

    this.plumber.addEndpoint(block, {
        anchors:[0,0.5,-1,0],
        isTarget: true,
        maxConnections: 1
    }, config.connectStyle);

	this.plumber.repaintEverything();

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
    // debugMsg(this.blockList);
    var exp = this.getExpression(blockID);
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
	debugMsg("seeking expression for ",blockID);
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

pipeInstance.prototype.deleteSelectedBlocks = function() {
	debugMsg("removing ",this.blockSelection.length," block(s)");
    for (var i = this.blockSelection.length-1; i>=0; i--) {
		this.removeBlock(this.blockSelection[i]);
	}
}

// block type - div to drag in and use
// position is a css expression of the blockType's position
// inConn is the number of input connections accepted (ie of parameters for function)
// blockHTML is a string giving the HTML to be used to display the block (label by default)
// blockValue - is a function to use when the block is called ($.text() by default)
function blockType(label, defGUI) {

    debugMsg("new block ",label,defGUI);

	this.element = undefined;
	this.pos = undefined;
	this.label = label;
    this.blockCode = defGUI.blockCode;
    this.getExp = defGUI.getExp;
    this.dropCode = defGUI.dropCode;
    this.inConn = (defGUI.args==='undefined')?2:defGUI.args;
    this.outConn = (defGUI.output==='undefined')?1:defGUI.output;
	this.uses = [];
}

blockType.prototype.addTo = function(pipe,position) {
	var elt = $('<div>').addClass('blockType');
    this.element = elt;

	this.setLabel(this.label);

    pipe.canvas.append(elt);
    this.setPos(position);

	// drag block
    elt.draggable({
		cursor: 'move',
		opacity: '0.5',
		zIndex: '2700',
		containment: 'document'
	});
}

blockType.prototype.addUse = function(block) {
    debugMsg(this.label, this.uses.length," uses");
    this.uses.push(block);
    debugMsg("Now ", this.uses.length," uses");
}

blockType.prototype.removeUse = function(block) {
    debugMsg("don't forget... Remove block use");
	var index = this.uses.indexOf(block);
	if (index > -1) {
		this.uses.splice(index, 1);
	}
}

blockType.prototype.setPos = function(position) {
	// position is either a number - to place type on a column on the left
	// or a css object of the form {top:y; left:x}
	if ($.isNumeric(position))
        position = {top:55*position+10,left:10};

	if ($.isNumeric(position.top) || $.isNumeric(position.bottom))
		this.pos = position;

    this.moveBack();
	debugMsg("new pos ",this.pos);
}

blockType.prototype.moveBack = function() {
    if (this.pos) {
		debugMsg("back to ", this.pos);
        this.element.css(this.pos);
    }
}

// sets the new label for a given block
// if the new label is a duplicate, returns 'false' and doesn't set
// otherwise, returns 'true' and sets.
blockType.prototype.setLabel = function(label) {
	if (label != '' && mainPipe.blockTypeList[label]===undefined) {
		this.element.html(label);
		mainPipe.blockTypeList[label] = this;
		debugMsg("added ",this," to blockTypeList ",mainPipe.blockTypeList.length);
		return true;
	}
	else {
		return false;
	}
}

blockType.prototype.changeLabel = function(newLabel) {
	if (newLabel != '' && mainPipe.blockTypeList[newLabel]===undefined) {
		this.element.html(newLabel);
		mainPipe.blockTypeList[newLabel] = this;
		delete mainPipe.blockTypeList[this.label];
		debugMsg("changed ",this.label," in blockTypeList ",mainPipe.blockTypeList.length);
		this.label = newLabel;
		debugMsg("renaming the uses ", this.uses.length);
		this.uses.map(function(block) {
			block.setHTML();
		})			
		return true;
	}
	else {
		return false;
	}
}

blockType.prototype.addArgument = function() {
	this.uses.map(function(block) {
		block.addInput();
	});
    this.inConn++;
}

blockType.prototype.removeArgument = function(n) {
	debugMsg("remove argument num ", n, " of ",this.inConn);
	var ok = true;
	if (this.inConn >= n) {
		var ct = 0;
		for (var i = this.uses.length-1; i>=0; i--) {
			ct += this.uses[i].numOfConnectors(n);
		}
		debugMsg("removing ", ct, " connectors");
		if (ct>0) {
			ok = confirm('There are '+ct+'connectors into this block. Remove the argument?');
		}
		if (ok) {
			this.inConn--;
			this.uses.map(function(block) {
				block.removeInput(n);
			});
		}
	}
	return ok;
}

/*
function confirmDeleteArgument () {
	var alertIcon = $('span').class('ui-icon ui-icon-alert').css('float:left; margin:12px 12px 20px 0;');
	var body = $('p').add(alertIcon).HTML('The argument is used by existing connectors. Remove anyway?');
	var confirm = $('div').attr('title','Delete connected argument?').add(body);
	
	$( function() {
		confirm.dialog({
			resizable: false,
			height: "auto",
			width: 400,
			modal: true,
			buttons: {
				"Remove the argument": function() {
					$( this ).dialog( "close" );
					return true;
				},
				Cancel: function() {
					$( this ).dialog( "close" );
					return false;
				}
			}
		});
	});
}
*/

function blockInstance(type, pipe, pos) {
	debugMsg("new block");
    this.type = type; // blockType element - contains a lot of data
	this.pipe = undefined; // pipe (when the block is added)
	this.id = undefined;
	this.inPoints = []; // list of JSPlumb enpoints for inputs
    this.element = $('<div>').addClass('block');

	this.setHTML();
	this.setPosition(pos);
	this.setPipe(pipe);
}

blockInstance.prototype.setID = function(id) {
    this.element.attr('id',id);
	this.id = id;
}

blockInstance.prototype.setPipe = function(pipe) {
	this.pipe = pipe;
    this.setID(pipe.nextID());
    pipe.canvas.append(this.element);

	this.type.addUse(this);
    this.setOutput();
    this.setInputs();

	pipe.plumber.draggable(this.element, {containment: 'parent'});

	var that = this;
	this.element.click(function(e) {
		that.pipe.deselectAllBlocks();
        that.select();
        that.pipe.displayExpression(that.id);
		e.stopPropagation();
    });

	var dropCode = this.dropCode();
	if (dropCode != undefined) {
		debugMsg('running dropcode', dropCode);
		var block = this;
		eval(dropCode);
    }
}

blockInstance.prototype.setOutput = function() {
	debugMsg("Adding block output");
    var endProps;
    if (this.outConnections() == -1) {
		debugMsg("using -1 connection limit");
    	endProps = {anchor:[1,0.5,1,0], isSource: true, maxConnections: -1};
    } else {
        endProps = {anchor:[1,0.5,1,0], isSource: true};
    }
    this.pipe.plumber.addEndpoint(this.element, endProps, config.connectStyle);
}

blockInstance.prototype.setInputs = function() {
    // check if input connections are required for this block
	var inConn = parseInt(this.inConnections());
    if (inConn>0) {
        // add input connections
		debugMsg("There are ",inConn," inputs");
        var pos;
        var ct;
        for (ct=0; ct<inConn; ct++) {
            this.addInput(ct);
        }
    }
}

blockInstance.prototype.addInput = function(num) {
	if (num===undefined) num = this.type.inConn;
	var pos = 0.1+num/3.5;
	var e = this.pipe.plumber.addEndpoint(this.element, {
		anchors:[[pos, 0, 0, 1]],
		isTarget: true,
		maxConnections: 1
	}, config.connectStyle);
	this.inPoints.push(e);
}

blockInstance.prototype.removeInput = function(num) {
	debugMsg("Removing input num ",num+1," of block ",block.id);
	this.pipe.plumber.deleteEndpoint(this.inPoints[num]);
	this.inPoints.splice(num,1);
	for (var pos; num<this.inPoints.length; num++) {
		pos = 0.1+num/3.5;
		this.inPoints[num].setAnchor([pos, 0, 0, 1]);
	}
	debugMsg(block.id, " has ", this.inPoints.length, " arguments");
}

blockInstance.prototype.numOfConnectors = function(n) {
	var input = this.inPoints[n].anchor;
	var cs = this.pipe.plumber.getConnections({target:this.id});
	cs.filter(function(conn) {
		var target = conn.endpoints[1].anchor;
		// debugMsg("Comparing: ",target,input);
		return (target==input);
	});
	debugMsg("Connections to remove: ",cs.length);
	return cs.length;
}

blockInstance.prototype.setPosition = function(pos) {
    this.element.css(pos);
}

blockInstance.prototype.setHTML = function() {
    var inHTML = this.type.label;

    if (typeof (this.type.blockCode) !== 'undefined') {
        inHTML += '<br />'+this.type.blockCode
	}
	
	this.element.html(inHTML);
}

blockInstance.prototype.getExpression = function() {
    var res;
	var getExp = this.type.getExp;
    if (typeof (getExp) !== 'undefined') {
		debugMsg('found getExp string ', getExp);
		var block = this.element;
		eval("function f() {"+getExp+"}");
		res = f();
    }
    else {
		res = this.type.label;
    }
    return res;
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
	return parseInt(this.type.outConn);
}

// selecting is initiated by the block
blockInstance.prototype.select = function () {
	focusPipe = this.pipe;
	this.pipe.selectBlock(this);
    this.element.addClass("blockSelected");
}

// deselecting is initiated by the pipe that 'owns' the block
blockInstance.prototype.deselect = function () {
    this.element.removeClass("blockSelected");
}

blockInstance.prototype.remove = function () {
    this.element.remove();
	this.type.removeUse(this);
}

function editBlock() {
   bE = new blockEditor('test');
   $('#createNewBlock').attr('disabled','disabled');
}

function blockEditor(label) {
	debugMsg("making block editor");

	this.blockNameGen = new tokenGenerator('newBlock'); // block names (newBlock1, ...)

    var inpt = $('<input type="text" size=7 />');
	var form = $('<form>').append('Block:').append(inpt);

    this.editor = $('<div>').attr('id',label).attr('title','Edit block');
    this.editor.append(form);
    this.editor.dialog({width: 560, height:420});

	this.userBlock = new customBlock(this);

	that = this;

	inpt.val(this.userBlock.name)
		.on('input', function() {that.userBlock.rename(this.value);} );

	this.editor.on('dialogclose', function() {
        that.close();
    });

	this.editor.droppable({
		tolerance: 'pointer',
		over: function() {
			mainPipe.canvas.droppable('disable');
		},
		out: function() {
			mainPipe.canvas.droppable('enable');
		},
		drop: function(event,ui) {
			that.drop(ui.draggable,ui.offset);
		}
    });

	return this;
}

/*
blockEditor.prototype.deleteArgument = function(block) {
	// var argName = block.find('form > input')[0].value;
	var ok = true;
	var i = this.argList.indexOf(block);
	if (i>-1) {
		ok = this.customType.removeArgument(i);
		if (ok) {
			this.argList.splice(i,1);
			// this.argsNum--;
		}
	}
	return ok;
}

blockEditor.prototype.findArgument = function(block) {
	var result = undefined;
	debugMsg("looking if this block ", block.id," in argList");
	for (a in this.argList) {
		debugMsg("is it ",a,this.argList[a].id);
		if (this.argList[a].id===block.id) {
			debugMsg("Yes");
			result = a;
			break;
		} else debugMsg("no");
	}
	return result;
}

blockEditor.prototype.renameBlock = function(newName) {
	var name = this.blockName;
	debugMsg("renaming ",name," to ",newName);
	if (this.customType.changeLabel(newName)) {
		this.blockName = newName;
	}
}

*/

blockEditor.prototype.close = function() {
	$('#createNewBlock').removeAttr('disabled','disabled');
	var ex = this.pipe.getExpression('end');
	if (ex != undefined) {
		// alert(ex);
	}
}

blockEditor.prototype.drop = function(dropped, offset) {
	if (dropped.hasClass('blockType')) {
		var edPos = this.editor.offset();
		t = offset.top-edPos.top;
		l = offset.left-edPos.left;
		this.userBlock.pipe.addBlock(dropped,{top:t, left:l});
		mainPipe.canvas.droppable('enable');
	}
}

/*
blockEditor.prototype.nextArgID = function() {
	this.argIndex++;
	return 'arg'+this.argIndex;
}

blockEditor.prototype.nextBlockNum = function() {
	this.blockNum++;
	return 'newBlock'+this.blockNum;
}
*/

function customBlock(editDialog) {
	// this is block-specific
	debugMsg("making block");
	this.name = editDialog.blockNameGen.next();
	this.num = editDialog.blockNameGen.num();
	this.argGen = new tokenGenerator('arg'); // makes argNames (arg1, arg2...)
	this.argList = []; // list of arguments
	this.customType = this.newType(mainPipe); // blockType

	this.pipe = new pipeInstance(editDialog.editor);
    this.addArgType();
	this.pipe.addEndBlock();
	return this;
}

customBlock.prototype.addArgType = function() {
	var argType = {};
	argType.args = 0;
	argType.blockCode = "<form><input type='text' size=3/><form>";
	argType.dropCode ="bE.userBlock.newArgument(block);";
	argType.getExp = "var inpt = block.find('form > input')[0]; return inpt.value;";
	argType.output = -1; // number of output connections is illimited
    this.pipe.addBlockType(new blockType('Argument',argType), {top:10, left:470});
}

customBlock.prototype.rename = function(newName) { //was renameBlock
	debugMsg("renaming ",this.name," to ",newName);
	if (this.customType.changeLabel(newName)) {
		this.name = newName;
	}
}

customBlock.prototype.newArgument = function(block) {
    var inpt = block.element.find('form > input')[0];
	var argName = this.argGen.next(); 
	inpt.value = argName;
	this.argList.push(block);
	// this.argsNum++;
	this.customType.addArgument();
	debugMsg("new argument ",block.id,argName);
}

customBlock.prototype.findArgument = function(testArg) {
	var result = undefined;
	debugMsg("looking if this block ", testArg.id," in argList");
	for (a in this.argList) {
		debugMsg("is it ",a,this.argList[a].id);
		if (this.argList[a].id===testArg.id) {
			debugMsg("Yes");
			result = a;
			break;
		} else debugMsg("no");
	}
	return result;
}

customBlock.prototype.newType = function(pipe) {
	var cT = new blockType(this.name,{args:this.argList.length});
	debugMsg("adding type");
    pipe.addBlockType(cT,{top:40+55*(this.num-1), left:1150});
	return cT;
}

customBlock.prototype.deleteArgument = function(arg) {
	var ok = true;
	var i = this.argList.indexOf(arg);
	if (i>-1) {
		ok = this.customType.removeArgument(i);
		if (ok) {
			this.argList.splice(i,1);
			// this.argsNum--;
		}
	}
	return ok;
}

function tokenGenerator(tok) {
   this.tokIndex = 0;
   this.tokString = tok;
   return this;
}

tokenGenerator.prototype.next = function() {
	this.tokIndex++;
	return this.tokString+this.tokIndex;	
}

tokenGenerator.prototype.num = function() {
	return this.tokIndex;	
}

