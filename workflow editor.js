
/* start:
   - load the file of predefined functions
   - launch initialisation
*/

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
			if (groups.contains(group)) {
				// if it is not new (pre-existing block)
				// then drop-down should be populated with data about new block
				// in which case numBlock shouldn't be incremented.
				groups.get(group).push(block);
			} else {
				// if it is a new group, a block should be added that has a drop down,
				// for that the first block's name filled
				groups.add(group,[defGUI,block]);
			}
		}
		else {
		// the block is stand-alone
			// position and add the block
			mainPipe.addBlockType(new blockType(block, defGUI), numBlock ); // was args, as defined above 2017-01-28
			numBlock++;
		}
	}
	debugMsg(groups.list);

	for (block_group in groups.list) {
		group = groups.get(block_group);
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
	this.tokenList = new collection(); // for generating the list of tokens 
	this.defunList = new collection(); // for generating the list of defuns
	this.blockSelection = new bag(); // list of blocks selected for interaction
	this.blockList = new collection(); // all block objects on this pipe
	this.blockTypeList = new collection(); // all block types available to drag

	/*
	this.plumber.bind("connection", function(info) {
		// ***** endpoint object updated here??
		debugMsg('connecting ', info.source);
		debugMsg('to ', info.target);
		debugMsg('via ', info.sourceEndpoint);
		debugMsg('and ', info.targetEndpoint);
	});
	*/

	that = this;
	this.canvas.click(function(e) {
		// If the click was not inside the active span
		debugMsg("click");
		if(!$(e.target).hasClass('blockSelected')) {
			e.stopPropagation();			
			debugMsg("canvas clicked");
			that.deselectAllBlocks();
		}
	});
}

pipeInstance.prototype = {
	addBlockType: function(blockType, position) {
		blockType.addTo(this,position);
	},

	removeBlockType: function(label) {
		var bT = this.blockTypeList.get(label);
		this.canvas.remove(bT.element);
		this.blockTypeList.remove(label);
	},

	addBlockGroup: function (label, groupData, position) {
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

	},

	/* addBlock: create a new block of the given type.
	   the attributes within blockType provide all the data to customise the block.
	   inConn is the number of input connections accepted (ie of parameters for function)
	*/
	addBlock: function (blockType, pos) {
		debugMsg("Adding a block at position ", pos, " of type ", blockType.html() );
		var realType = this.blockTypeList.get(blockType.html());
		if (!realType) {
			realType = mainPipe.blockTypeList.get(blockType.html());
		}
		realType.moveBack();
		var b = new blockInstance(realType, this, pos);
		this.blockList.add(b.id, b);
	},

	removeBlock: function(block) {
		var ok = true;
		if (focusPipe != mainPipe) {
			if (currentBE.userBlock.isArgument(block)) {
				debugMsg("the block is an argument");
				ok = currentBE.userBlock.deleteArgument(block);
			}
		}
		if (ok) {
			this.plumber.detachAllConnections(block.element);
			this.plumber.removeAllEndpoints(block.element);
			// ***should also clean up the endpoint objects?
			this.plumber.detach(block.element);
			this.deselectBlock(block);
			this.blockList.remove(block.id);
			block.remove();
		}
	},

	/* // create new connector
	pipeInstance.prototype.addConnector: function(from,to) {

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
	*/

	/* adding the 'endBlock'. Unlike others,
	   it has no output endpoint; it also can't be removed from the canvas.
	   this would be best organised with inheritance. Not done yet.
	*/
	addEndBlock: function () {
		var blockID = 'end';
		var block = $('<div>').attr('id',blockID).addClass('block').html("End");
		this.blockList.add(blockID, this);
		this.type = {id: 'end'};

		this.canvas.append(block);
		block.css({bottom:10, right:10});

		// *** this should be making an endPoint target object to add
		this.plumber.addEndpoint(block, {
			anchors:[0,0.5,-1,0],
			isTarget: true,
			maxConnections: 1
		}, config.connectStyle);

		/*** endPoint object attempt - in progress
		// var ep = (new blockEndpoint()).setTarget().setPos('left');
		// ep.addTo(block);
		*/
		
		//this.plumber.repaintEverything();

		var that = this;
		$(block).click(function(e) {
			e.stopPropagation();
			that.blockSelection.clear();
			that.displayExpression(blockID);
		});
	},

	// output function to view the expression for a block
	displayExpression: function (blockID) {
		this.tokenList.clear();
		this.defunList.clear();
		// debugMsg(this.blockList);
		var exp = this.getExpression(blockID);
		debugMsg("Exp before defuns",exp);
		var elements = new bag();
		if (this.defunList.empty()) {
			debugMsg("No defuns");
		} else {
			debugMsg("Some defuns",this.defunList);
			for (var id in this.defunList.list) {
				exp = this.defunList.get(id).concat([exp]);
			}
			debugMsg(exp);
		}
		/*
		if (this.tokenList.empty()) {
			debugMsg("No tokens");
		} else {
			debugMsg("Some tokens");
			for (var id in this.tokenList.list) {
				elements.queue(["setq", id, this.tokenList.get(id)]);
			}
		}
		*/
/*		if (elements.empty()) {
			debugMsg("Keep exp alone");
			result = exp;
		} else {
			debugMsg("Push exp",exp,"into list",elements.list);
			elements.queue(exp);
			result = elements.list;
		}
		*/
		debugMsg(exp);
		$('#s-exp').val(JSON.stringify(exp));
	},

	getExpression: function (blockID) {

		debugMsg("seeking expression for ",blockID);

		var block = this.blockList.get(blockID);
		//debugMsg("block is",block);

		// Connections is the list of connections that target this block
		// jsPlumb doesn't offer a method for filtering this by endPoint.
		var connections = this.plumber.getConnections({ target:blockID });
		debugMsg(connections.length, "connections found");
		
		//op contains the result
		var op;

		// the bizarre 'end' block breaks everything
		// end bloock is a different case because
		// inPoints are not properly set up. Needs repair
		if (blockID==='end') {
			if (connections.length==1)
				op = this.getExpression(connections[0].sourceId)
			else
				op = null;
		}
		else {

			// inputs is the list of Input endPoints for the block
			var inputs = block.inPoints;
			debugMsg(inputs.size(), "input points found");

			// exp is the expression contained in the current block.
			var exp = block.getExpression();

			if (inputs.size()>0) {
				if (exp == "setq") {
					if (!this.tokenList.contains(blockID)) {
						// set the token value according to the expression connected source
						// or to null if there is none
						var v = (connections.length>0)?this.getExpression(connections[0].sourceId):null;
						this.tokenList.add(blockID,v);
						op = ["setq", blockID, v]
					} else {
						op = blockID;						
					}
				}
				else {
					op = [exp];
					if (custom_functions.contains(exp)) {
						if (!this.defunList.contains(exp)) {
							this.defunList.add(exp,custom_functions.get(exp));
						}
					}
					for (var i = 0; i<inputs.size(); i++) {
						// iterate through inputs
						// find if theres a connection for each input, use if yes, null if not
						debugMsg("checking input",i);
						var curr_in = inputs.get(i);
						var source = curr_in.findConnectedSource(connections);
						var e = source?this.getExpression(source):null;
						op.push(e);
					}
					/*
					for (var i = 0; i<connections.length; i++) {
						op.push(this.getExpression(connections[i].sourceId));
					}
					*/
				}
			}

			else op = exp;

		}
		debugMsg("Got expression", op);
		return op; 
	},

	// Generate a unique ID for each block in this pipe
	nextID: function () {
		var result = 'id'+this.idNum;
		this.idNum++;
		return result;	
	},

	selectBlock: function (block) {
		debugMsg("selecting block",block.id);
		this.blockSelection.queue(block);
	},

	deselectBlock: function (block) {
		debugMsg("Deselecting block",block.id);
		if (this.blockSelection.contains(block)) {
			this.blockSelection.remove(block);
			block.deselect(this);
		}
	},

	deselectAllBlocks: function() {
		debugMsg("Deselecting all blocks");
		while (this.blockSelection.size()>0)
			this.deselectBlock(this.blockSelection.get(0));
	},

	deleteSelectedBlocks: function() {
		debugMsg("removing ",this.blockSelection.size()," block(s)");
		for (var i = this.blockSelection.size()-1; i>=0; i--) {
			this.removeBlock(this.blockSelection.get(i));
		}
	}
}

/* block type - div to drag in and use
   position is a css expression of the blockType's position
   inConn is the number of input connections accepted (ie of parameters for function)
   blockHTML is a string giving the HTML to be used to display the block (label by default)
   blockValue - is a function to use when the block is called ($.text() by default)
*/

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
	this.uses = new bag();
}

blockType.prototype = {
	addTo: function(pipe,position) {
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
	},

	addUse: function(block) {
		debugMsg(this.label, this.uses.size()," uses");
		this.uses.queue(block);
		debugMsg("Now ", this.uses.size()," uses");
	},

	removeUse: function(block) {
		debugMsg("don't forget... Remove block use");
		var index = this.uses.remove(block);
	},

	setPos: function(position) {
		// position is either a number - to place type on a column on the left
		// or a css object of the form {top:y; left:x}
		if ($.isNumeric(position))
			position = {top:55*position+10,left:10};

		if ($.isNumeric(position.top) || $.isNumeric(position.bottom))
			this.pos = position;

		this.moveBack();
		debugMsg("new pos ",this.pos);
	},

	moveBack: function() {
		if (this.pos) {
			debugMsg("back to ", this.pos);
			this.element.css('top', 'auto').css('left', 'auto').css(this.pos);
		}
	},

	// sets the new label for a given block
	setLabel: function(label) {
		if (label != '') {
			this.element.html(label);
			mainPipe.blockTypeList.add(label, this);
			debugMsg("added ",label," to blockTypeList ",mainPipe.blockTypeList.size());
			return true;
		}
		else {
			return false;
		}
	},

	changeLabel: function(newLabel) {
		if (newLabel != '' && (!mainPipe.blockTypeList.contains(newLabel))) {
			this.element.html(newLabel);
			mainPipe.blockTypeList.add(newLabel,this);
			mainPipe.blockTypeList.remove(this.label);
			debugMsg("changed ",this.label," in blockTypeList ",mainPipe.blockTypeList.size());
			this.label = newLabel;
			debugMsg("renaming the uses ", this.uses.size());
			this.uses.map(function(block) {
				block.setHTML();
			})
			return true;
		}
		else {
			return false;
		}
	},

	addArgument: function() {
		this.uses.map(function(block) {
			block.addInput();
		});
		this.inConn++;
	},

	removeArgument: function(n) {
		debugMsg("remove argument num ", n, " of ",this.inConn);
		var ok = true;
		if (this.inConn >= n) {
			var ct = 0;
			for (var i = this.uses.size()-1; i>=0; i--) {
				ct += this.uses.get(i).numOfConnectors(n);
			}
			debugMsg("removing ", ct, " connectors");
			if (ct>0) {
				ok = confirm('This argument is being used by '+ct+' connectors. Are you sure you want to remove it?');
			}
			if (ok) {
				this.inConn--;
				this.uses.map(function(block) {
					debugMsg("removing input",n,"from block",block.id);
					block.removeInput(n);
				});
			}
		}
		return ok;
	}
}

// blockInstance
function blockInstance(type, pipe, pos) {
	debugMsg("new block");
	this.type = type; // blockType element - contains a lot of data
	this.pipe = undefined; // pipe (when the block is added)
	this.id = undefined;
	this.inPoints = new bag(); // list of JSPlumb enpoints for inputs
	this.outPoint = undefined; // outPoint is the endPoint object, needed to find connections
	this.element = $('<div>').addClass('block');

	this.setHTML();
	this.setPosition(pos);
	this.setPipe(pipe);
}

blockInstance.prototype = {
	setID: function(id) {
		this.element.attr('id',id);
		this.id = id;
	},

	setPipe: function(pipe) {
		this.pipe = pipe;
		this.setID(pipe.nextID());
		pipe.canvas.append(this.element);

		this.type.addUse(this);
		this.setOutput();
		this.setInputs();

		pipe.plumber.draggable(this.element, {containment: 'parent'});

		var that = this;
		this.element.click(function(e) {
			e.stopPropagation();
			that.pipe.deselectAllBlocks();
			that.select();
			that.pipe.displayExpression(that.id);
		});

		var dropCode = this.dropCode();
		if (dropCode != undefined) {
			debugMsg('running dropcode', dropCode);
			var block = this;
			eval(dropCode);
		}
	},

	// *** using new endPoint object
	setOutput: function() {
		debugMsg("Adding block output");
		var e = (new blockEndpoint()).setSource().setPos('right');
		debugMsg(e.getAnchor())
		if (this.outConnections() == -1) {
			e.setMulti();
		}
		this.outPoint = e;
		e.addTo(this);
	},

	setInputs: function() {
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
	},

	// *** using new endPoint object
	addInput: function(num) {
		if (num===undefined) num = this.type.inConn;
		var e = (new blockEndpoint()).setPos('top',num).addTo(this);
		debugMsg("added endpoint to block",this.id,e.ep.getParameters());
		this.inPoints.queue(e);
	},

	// *** using new endPoint object
	removeInput: function(num) {
		debugMsg("Removing input num ",num," of block ",this.id);
		var iP = this.inPoints.get(num);
		iP.remove();
		for (this.inPoints.remove(iP); num<this.inPoints.size(); num++) {
			debugMsg("shifting ",num);
			iP = this.inPoints.get(num);
			debugMsg("endPoint to shift details",iP.ep.getParameters());
			iP.setPos('top',num).updateProps();
			debugMsg("done");
		}
		debugMsg(this.id, " has ", this.inPoints.size(), " arguments");
	},

	numOfConnectors: function(n) {
		var c = input.isConnected()?1:0;
		debugMsg("Connections to remove: ",c);
		return c;
	},

	setPosition: function(pos) {
		this.element.css(pos);
	},

	getPosition: function() {
		// function should exist, but not working?
		t = this.element.css('top');
		l = this.element.css('left');
		return {'top':t, 'left':l}
	},

	setHTML: function() {
		var inHTML = this.type.label;

		if (typeof (this.type.blockCode) !== 'undefined') {
			inHTML += '<br />'+this.type.blockCode
		}
		
		this.element.html(inHTML);
	},

	getExpression: function() {
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
	},

	// get block dropCode 
	dropCode: function() {
		return this.type.dropCode;
	},

	// get number of accepted input connections for the block
	inConnections: function() {
		return parseInt(this.type.inConn);
	},

	outConnections: function() {
		return parseInt(this.type.outConn);
	},

	// selecting is initiated by the block
	select: function () {
		focusPipe = this.pipe;
		this.pipe.selectBlock(this);
		this.element.addClass("blockSelected");
	},

	// deselecting is initiated by the pipe that 'owns' the block
	deselect: function () {
		this.element.removeClass("blockSelected");
	},

	remove: function () {
		this.element.remove();
		this.type.removeUse(this);
	},
	
	repaint: function() {
		this.pipe.plumber.repaint(this.element);
	}
}

// endPoint object 
// in progress
function blockEndpoint() {
	this.block = {};
	this.properties = {};
	this.ep = {};
	this.anchors = [];
	
	//default settings
	this.setTarget(); // default into, not from, this end point

	return this;
}

blockEndpoint.prototype = {

	setTarget: function() {
		this.properties.isTarget = true;
		this.properties.isSource = false;
		this.setExclusive(); // target of only one source
		return this;		
	},
	setSource: function() {
		this.properties.isTarget = false;
		this.properties.isSource = true;
		return this;		
	},
	isTarget: function() {
		return this.properties.isTarget;
	},
	isSource: function() {
		return this.properties.isSource;
	},

	setExclusive: function() {
		return this.setMultiConnections(false);
	},
	setMulti: function() {
		return this.setMultiConnections(true);
	},
	setMultiConnections: function(multi) {
		if (multi && this.isSource()) {
			// sanity check - only allowed if the endPoint is a source
			debugMsg("using -1 connection limit");
			this.properties.maxConnections = -1;
		}
		else
			this.properties.maxConnections = 1
		return this;
	},
	isMultiConnections: function() {
		if (this.properties.maxConnections == -1)
			return true
		else
			return false;
	},

	setPos: function(side,n) {
		var p;
		if (n==null) p=0.5
		else p = 0.1+n/3.5;
		debugMsg("endPoint pos",n,p);
		var a = [];
		switch (side) {
			case 'left': a = [0,p,-1,0]; break;
			case 'top': a = [p, 0, 0, 1]; break;
			case 'right': a = [1,p,1,0];
		}
		//debugMsg('anchors',a);
		return this.setAnchor(a);
	},
	setAnchor: function(p) {
		this.properties.anchors = p;
		debugMsg('anchors',p);
		return this;
	},
	getAnchor: function() {
		return this.properties.anchors;
	},

	/*
	getConnections(): function() {
		//var = this.ep.id???
		//this.block.plumber.getConnections({ target:??? });
	}
	*/
	
	//isConnected returns true if the endPoint is a connected-target-
	//it doesn't apply to source
	isConnected: function() {
		if (this.isTarget())
			return this.ep.isFull();
		else
			return null;
	},
	
	findConnectedSource: function(connList) {
		// to find if a block is connected to this endPoint
		// first see if the outPoint is full
		// if yes, go through the blocks in the connList, and for each block,
		// find if the connList contains the matching source.
		// not an efficient process, but a limit of JSPlumb
		// a better setup for this might be to maintain this data
		// when the user creates/removes the connections
		res = null;
		var i=0;
		debugMsg("Checking connection");
		if (this.isConnected()) {
			debugMsg("there is one, seeking among", connList.length);
			for (var i=0; i<connList.length; i++) {
				var e = connList[i].endpoints;
				debugMsg("trying source",i, e);
				var tep = e[1];
				if (this.ep===tep) {
					res=$(e[0].getElement()).attr("id");
					debugMsg("found block",res);
					break;
				}
			}
		}
		return res;
	},

	addTo: function(b) {
		debugMsg("adding endpoint with props", this.properties);
		this.block = b;
		e = b.pipe.plumber.addEndpoint(b.element, this.properties, config.connectStyle);
		debugMsg("Endpoint added ",e.anchor);
		this.ep = e;
		return this;
	},

	updateProps: function() {
		debugMsg("props changed to",this.ep.anchor, this.properties);
		//setParameters not working as documented
		//this.ep.setParameters(this.properties);
		this.ep.anchor.x = this.getAnchor()[0];
		this.block.repaint();
	},

	remove: function() {
		this.ep.detachAll();
		this.block.pipe.plumber.deleteEndpoint(this.ep);
	}
}

/*
	// ****** all this code should be using the endPoint target object

	// How to use - call to make an endPoint
	// a set of endpoints in each block?

	// line 199
	// should also clean up the endpoint objects?

	// line 240 - single target of end block
	this.plumber.addEndpoint(block, {
		anchors:[0,0.5,-1,0],
		isTarget: true,
		maxConnections: 1
	}, config.connectStyle);

	// Could be:
	(new blockEndPoint()).setTarget().setPos('left').addTo(this);

	// line 551 - source endPoint
	// should be via an endPoint object
	setOutput: function() {
		debugMsg("Adding block output");
		var endProps;
		if (this.outConnections() == -1) {
			debugMsg("using -1 connection limit");
			endProps = {anchor:[1,0.5,1,0], isSource: true, maxConnections: -1};
		} else {
			endProps = {anchor:[1,0.5,1,0], isSource: true};
		}
		this.pipe.plumber.addEndpoint(this.element, endProps, config.connectStyle);
	},

	// Changed to:
	setOutput: function() {
		debugMsg("Adding block output");
		var e = (new endPoint()).setSource().setPos('right');
		if (this.outConnections() == -1) {
			e.setMulti();
		}
		e.addTo(this.element);
	},

	// line 575
	// should be via an endPoint object
	addInput: function(num) {
		if (num===undefined) num = this.type.inConn;
		var pos = 0.1+num/3.5;
		var e = this.pipe.plumber.addEndpoint(this.element, {
			anchor:[pos, 0, 0, 1],
			isTarget: true,
			maxConnections: 1
		}, config.connectStyle);
		this.inPoints.queue(e);
	},

	// could be
	addInput: function(num) {
		if (num===undefined) num = this.type.inConn;
		var e = (new endPoint()).setPos('top',num).addTo(this.element);
		this.inPoints.queue(e);
	},

	// line 583
	// should be via an endPoint object
	removeInput: function(num) {
		debugMsg("Removing input num ",num+1," of block ",this.id);
		var iP = this.inPoints.get(num);
		this.pipe.plumber.deleteEndpoint(iP);
		this.inPoints.remove(iP);
		for (var pos; num<this.inPoints.size(); num++) {
			pos = 0.1+num/3.5;
			debugMsg("shifting ",num," to ", pos);
			this.inPoints.get(num).setAnchor([pos, 0, 0, 1]);
			debugMsg("done");
		}
		debugMsg(this.id, " has ", this.inPoints.size(), " arguments");
	},

	// could be
	// review setPos to allow *move* and create a remove method
	removeInput: function(num) {
		debugMsg("Removing input num ",num+1," of block ",this.id);
		var iP = this.inPoints.get(num);
		iP.remove();
		for (this.inPoints.remove(iP); num<this.inPoints.size(); num++) {
			debugMsg("shifting ",num);
			this.inPoints.get(num).setPos('top',num);
			debugMsg("done");
		}
		debugMsg(this.id, " has ", this.inPoints.size(), " arguments");
	},

	// line 596
	// should be via an endPoint object
	numOfConnectors: function(n) {
		var input = this.inPoints.get(n).anchor;
		var cs = this.pipe.plumber.getConnections({target:this.id});
		cs.filter(function(conn) {
			var target = conn.endpoints[1].anchor;
			// debugMsg("Comparing: ",target,input);
			return (target==input);
		});
		debugMsg("Connections to remove: ",cs.length);
		return cs.length;
	}

	// could be??? needs work!!
	
*/

function editBlock() {
	currentBE = new blockEditor();
	$('#createNewBlock').attr('disabled','disabled');
}

function blockEditor() {
	debugMsg("making block editor");

	var inpt = $('<input type="text" size=7 />');
	var form = $('<form>').append('Block:').append(inpt);

	this.editor = $('<div>').attr('title','Edit block');
	this.editor.append(form);
	this.editor.dialog({width: 560, height:420});

	this.makeArgType();

	this.setUserBlock(new customBlock(this));

	this.userBlock.pipe.addEndBlock();

	return this;
}

blockEditor.prototype = {
	setUserBlock: function(userBlock) {
		this.userBlock = userBlock;

		this.editor.find("input")
			.off('input')
			.on('input', function() {userBlock.rename(this.value);} )
			.val(userBlock.name);

		this.editor.on('dialogclose', function() {
			userBlock.done();
		});

		this.editor.on('dialogresize', function() {
			userBlock.pipe.plumber.repaintEverything();
		});

		that = this;
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
	},
	drop: function(dropped, offset) {
		if (dropped.hasClass('blockType')) {
			var edPos = this.editor.offset();
			t = offset.top-edPos.top;
			l = offset.left-edPos.left;
			this.userBlock.pipe.addBlock(dropped,{top:t, left:l});
			mainPipe.canvas.droppable('enable');
		}
	},
	makeArgType: function() {
		var argType = {};
		argType.args = 0;
		argType.blockCode = "<form><input type='text' size=3/><form>";
		argType.dropCode ="currentBE.userBlock.newArgument(block);";
		argType.getExp = "var inpt = block.find('form > input')[0]; return inpt.value;";
		argType.output = -1; // number of output connections is illimited
		this.argType = new blockType('Argument',argType);
	}
}

function customBlock(editDialog) {
	// this is block-specific
	debugMsg("making block");
	this.name = edGen.next();
	this.num = edGen.num();
	this.argGen = new tokenGenerator('arg'); // makes argNames (arg1, arg2...)
	this.argList = new bag(); //[]; // list of arguments
	this.customType = this.newType(); // blockType
	this.pipe = new pipeInstance(editDialog.editor);
	this.pipe.addBlockType(editDialog.argType, {top:10, right:10}); // was left:470
	this.bE = editDialog;
	this.edit = undefined;
	return this;
}

customBlock.prototype = {

	rename: function(newName) {
		debugMsg("renaming ",this.name," to ",newName);
		if (this.customType.changeLabel(newName)) {
			this.name = newName;
		}
	},

	newArgument: function(block) {
		var inpt = block.element.find('form > input')[0];
		var argName = this.argGen.next(); 
		inpt.value = argName;
		this.argList.queue(block); // push(block);
		// this.argsNum++;
		this.customType.addArgument();
		debugMsg("new argument ",block.id,argName);
	},

	isArgument: function(block) {
		var result = this.argList.contains(block);
		debugMsg("Block ", block.id, " in argList?",result);
		return result;
	},

	newType: function() {
		var cT = new blockType(this.name,{args:this.argList.size()});
		debugMsg("adding type");
		cT.addTo(mainPipe,{top:40+55*(this.num-1), right:10});
		this.icons();
		return cT;
	},

	deleteArgument: function(arg) {
		var ok = false;
		if (this.argList.contains(arg)) {
			var i = this.argList.find(arg);
			ok = this.customType.removeArgument(i);
			if (ok) {
				this.argList.remove(arg);
				// this.argsNum--;
			}
		}
		return ok;
	},

	done: function() {
		this.saveDefun();
		$('#createNewBlock').removeAttr('disabled','disabled');
	},

	delete: function() {
		//this.saveDefun();
		// need to unsave...
		$('#createNewBlock').removeAttr('disabled','disabled');
		this.customType.element.remove();
	},

	saveDefun: function() {
		var def = this.defun();
		if (def != undefined) {
			debugMsg("new function: ",this.name, def);
			custom_functions.set(this.name, def);
		}
	},

	defun: function() {
		res = this.pipe.getExpression('end');
		if (res != undefined) {
			res = ["defun", this.name, this.argList.map(function (b) {return b.getExpression()}), res];
		}
		debugMsg(res);
		return res;
	},

	icons: function() {

		var height = 60+55*(this.num-1);
		var edit = $('<div>');
		var editIcon = $('<img>').
				   attr('src','icons/edit.jpg').
				   attr('width',24).
				   attr('height',24).
				   attr('alt','edit').
				   css({top:height, right:24, position:'absolute'});
		edit.append(editIcon);
		mainPipe.canvas.append(edit);
		var copy = $('<img>').attr('src','icons/copy.jpg').attr('width',24).attr('height',24).attr('alt','copy').css({top:height, right:48, position:'absolute'});
		var del = $('<img>').attr('src','icons/delete.jpg').attr('width',24).attr('height',24).attr('alt','delete').css({top:height, right:0, position:'absolute'});
		var delay;

		var that = this;
		del.on('click', function(e) {
			e.stopPropagation();
			edit.remove();
			//debugMsg(that);
			that.bE.userBlock.delete();
			that.bE.editor.dialog('close');
			that.pipe = undefined;
			//that.remove();
			// more needed!!
		});

		edit.on('mouseover', function() {
			clearTimeout(delay);
			edit.append(copy);		
			edit.append(del);
		});
		edit.on('mouseout', function() {
			delay = setTimeout(mo,1000);
		});
		edit.on('click', function(e) {
			e.stopPropagation();
			debugMsg('edit block');
			if (currentBE != that.bE) {
				debugMsg('change edited block');
				currentBE.editor.dialog('close');
				currentBE = that.bE;
			}
			if (currentBE.editor.is(":hidden")) {
				debugMsg('show editor');
				currentBE.editor.dialog('open');
			}
		});
		
		copy.on('click', function(e) { // was that.remove() - didn't work
			e.stopPropagation();
			// make a copy
			debugMsg('copy block');
			// var oldBlock = that;
			currentBE.editor.dialog('close');
			editBlock();
			var newName = that.name+'_copy'
			currentBE.userBlock.rename(newName);
			currentBE.editor.find("input").val(currentBE.userBlock.name);
			for (var bID in that.pipe.blockList.list) {
				if (bID!='end') {
					var oB = that.pipe.blockList.get(bID);
					debugMsg('old block', bID);
					var oType = oB.type.element;
					var oPos = oB.getPosition();
					debugMsg(oPos);
					currentBE.userBlock.pipe.addBlock(oType,oPos);
				}
			}
		});

		var mo = function() {
			copy.detach();
			del.detach();
		}

	}

	/* not called correctly from delete click event
	, // comma separating the methods
	customBlock.prototype.remove: function() {
		this.edit.remove();
	}
	*/
}

// bag = array of data (as in [a,b,c])
// with encapsulated functions for handling
function bag() {
	this.list = [];
}

bag.prototype = {
	clear: function() {
		this.list=[];
		return this;
	},

	empty: function() {
		return (this.size() == 0);
	},

	contains: function(e) {
		return this.list.indexOf(e)>=0;
	},

	queue: function (e) {
		this.list.push(e);
		return this;
	},

	queueAll: function (es) {
		debugMsg("queuing",es,"at the end of",this.list)
		es.forEach(e => this.queue(e));
		return this;
	},

	stack: function (e) {
		this.list.unshift(e);
		return this;
	},

	stackAll: function (es) {
		debugMsg("stacking ",es);
		es.forEach(this.stack);
		return this;
	},

	get: function(n) {
		return this.list[n];
	},

	remove: function (e) {
		if (this.contains(e)) {
			this.list.splice(this.list.indexOf(e),1)
			return this;
		} else {
			return false;
		}
	},

	removeAll: function (es) {
		return es(this.remove);
	},

	dequeue: function (n) {
		if (!n) n=1;
		do {this.list.shift();} while (n-->0);
		return this;
	},

	find: function(e) {
		return this.list.indexOf(e);
	},

	/* older, weirder version of find
	find: function(check) {
		var result = undefined;
		for (a in this.list) {
			debugMsg("is it ",a);
			if (check(this.list[a])) {
				debugMsg("Yes");
				result = a;
				break;
			}
		}
		return result;		
	},
	*/

	size: function() {
		return this.list.length;
	},
	
	map: function(f) {
		return this.list.map(f);
	}

};

// collection = object collecting data
// as in {name1: value1, name2: value2, name3: value3}
// with encapsulated functions for handling
function collection() {
	this.list = {};
}

collection.prototype = {
	clear: function() {
		this.list={};
		return this;
	},

	empty: function() {
		return (this.size() == 0);
	},

	contains: function(lbl) {
		return this.list[lbl] != undefined;
	},

	add: function (lbl,e) {
		if (this.contains[lbl])
			return false;
		this.list[lbl] = e;
		return this;
	},

	set: function (lbl,e) {
		this.list[lbl] = e;
		return this;
	},

	get: function(lbl) {
		return this.list[lbl];
	},
	
	remove: function (lbl) {
		if (this.contains(lbl)) {
			delete this.list[lbl];
			return this;
		} else {
			return false;
		}
	},

	removeAll: function (lbls) {
		return lbls.map(this.remove);
	},

	size: function() {
		return Object.keys(this.list).length;
	},

	map: function(f) {
		return this.list.map(f);
	}

};

// tokenGenerator - makes strings token+number
function tokenGenerator(tok,index) {
	this.tokIndex = $.isNumeric(index)?parseInt(index):1;
	this.tokString = tok;
	return this;
}

tokenGenerator.prototype = {
	next: function() {
		var res = this.tokString+this.tokIndex;
		this.tokIndex++;
		return res;
	},
	last: function() {
		return this.tokString+(this.tokIndex-1);
	},
	num: function() {
		return this.tokIndex;	
	}
}

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

/* Set of predefined functions
   predefined functions both define the blocks available to interconnect
   in a graphical interface and the code to use to compile the workflow 
*/

// set of functions available (used by compiler)
var predefined_functions;
// set of replacements - e.g. [plus 1 2] -> 1+2 - (used by compiler)
var predefined_replacements;
// GUI - for the draggable blocks
var predefined_gui;

// main space for plumbing
var mainPipe;

// blockEditor object
var currentBE;

// which pipe (main or blockeditor) has the focus
var focusPipe; // set to mainPipe at initialisation

var groups = new collection(); // set up UI

// set of custom (user-defined) functions
var custom_functions = new collection();

// current block names (newBlock1, ...)
var edGen = new tokenGenerator('newBlock');

