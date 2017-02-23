
// Set of predefined functions
// predefined functions both define the blocks available to interconnect
// in a graphical interface and the code to use to compile the workflow 

// set of functions available (used by compiler)
var predefined_functions;
// set of replacements - e.g. [plus 1 2] -> 1+2 - (used by compiler)
var predefined_replacements;
// GUI - for the draggable blocks
var predefined_gui;


// i: used to define a unique ID for blocks dragged to the canvas
var i = 1;

// position of blockType for the new block being brought in
var oldPos;

// currently selected block(s)
var blockSelection = [];

// start:
// - load the file of predefined functions
// - launch initialisation

jsPlumb.ready(function() {
    $.ajax({
        url: "functions.json",
        beforeSend: function(xhr){
            if (xhr.overrideMimeType) {
                xhr.overrideMimeType("application/json");
            }
        },
        success: function(json) {
            predefined_functions = json.js;
            predefined_replacements = json.replace;
            predefined_gui = json.gui;
            initialise();
        },
        error: function(_, status, err) {alert(status+'\n'+err);}
    });
});

// set up UI
var groups = [];

function initialise() {
    // initialise the GUI list of block types
    var numBlock = 0;
    var args;

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
    endBlock();

    // drag and drop blocks
    $( ".blockType" ).draggable({
        start: function( event, ui) {
            oldPos = $(this).position();
        },
        stop: function( event, ui ) {
            addBlock($(this),ui.position);
            $(this).css(oldPos);
        }
    });

    // delete selected block(s)
    $('html').keyup(function(e){
        if(e.keyCode == 46) {
            while (blockSelection.length>0) {removeBlock(blockSelection[0]);}
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
    for (i in group) {
        code += "<option value="+group[i]+">"+group[i]+"</option>"; // value missing
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

// addBlock: create a new block of the given type.
// the attributes within blockType provide all the data to customise the block.
// inConn is the number of input connections accepted (ie of parameters for function)
var idNum=0;
function addBlock(blockType, position) {

    var label = blockType.attr("id");
    var inHTML = label;

    if (typeof (blockType.attr("blockCode")) !== 'undefined') {
        inHTML += '<br />'+blockType.attr("blockCode");
    }
    
    var blockID = 'id'+idNum;
    idNum++; // need token generator
    
    var block = $('<div>')
                .attr('id',blockID)
                .addClass('block')
                .html(inHTML)
                .attr('label',label);
    if(position) {
        block.css(position);
    }

    $('#pipeContainer').append(block);

    var common = {
        endpoint:"Dot",
        paintStyle:{ fillStyle:"lightgrey" },
        hoverPaintStyle:{ fillStyle:"lightgreen" },
        connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
        connectorHoverStyle:{ strokeStyle:"lightgreen", lineWidth:10 },
        ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
    };
 
    var endProps;
    if (label == "setq") {
        endProps = {anchor:"Right", isSource: true, maxConnections: -1};
    } else {
        endProps = {anchor:"Right", isSource: true}
    }

    jsPlumb.addEndpoint(blockID, endProps, common);

    // check if input connections are required for this block
    if (inConn = blockType.attr("inConn")) {
        // add input connections
        var pos;
        var ct;
        for (ct=0; ct<inConn; ct++) {
            pos = 0.1+ct/3.5
            jsPlumb.addEndpoint(blockID, {
                anchors:[[pos, 0],"Top"],
                isTarget: true,
                maxConnections: 1
            }, common);
        }
    }

    jsPlumb.draggable(blockID, {containment: 'parent'});

    block.click(function() {
         blockSelection = []; // currently only one block can be selected
         selectBlock(block);
         displayExpression(blockID);
    });

    var exp;

    if (typeof (blockType.attr("getExp")) !== 'undefined') {
        eval("exp = function() {" + blockType.attr("getExp") + "}");
    }
    else {
        exp = function(){return label;};        
    }
    block.on("expression", exp)

    i++;

}

function selectBlock(block) {
    blockSelection.push(block);
    $(block).addClass("blockSelected");
    
    $('#pipeContainer').click(function(e) {
        // If the click was not inside the active span
        if(!$(e.target).hasClass('blockSelected')) {
            while (blockSelection.length>0) {deselectBlock(blockSelection[0]);}
            // Remove the bind as it will be bound again on the next span click
            $('#pipeContainer').unbind('click');
        }
    });
}

function deselectBlock(block) {
    var index = blockSelection.indexOf(block);
    if (index > -1) {
        blockSelection.splice(index, 1);
        $(block).removeClass("blockSelected");
    }
}

function removeBlock(block) {
    jsPlumb.detachAllConnections(block);
    jsPlumb.removeAllEndpoints(block);
    jsPlumb.detach(block);
    deselectBlock(block);
    block.remove();
}

// create new connector
function addConnector(from,to) {

    // define style of connectors
    var connStyle = {
        anchor:["Bottom","Left"],
        endpoint:"Dot"
    };

    jsPlumb.connect({
        source:from,
        target:to
    },
    connStyle); 
}

// the 'endBlock' is the return of the function defined. Unlike others,
// it has no output endpoint; it also can't be removed from the canvas.
function endBlock() {
    var blockID = 'end';
    var block = $('<div>').attr('id',blockID).addClass('block').html("End");
    block.css({bottom:10, right:10});
    
    $('#pipeContainer').append(block);
    
    var common = {
        endpoint:"Dot",
        paintStyle:{ fillStyle:"lightgrey" },
        hoverPaintStyle:{ fillStyle:"lightgreen" },
        connectorStyle:{ strokeStyle:"lightgrey", lineWidth:8 },
        connectorHoverStyle:{strokeStyle:"lightgreen", lineWidth:10 },
        ConnectorOverlays:[ ["Arrow" , { width:12, length:12, location:0.67 }] ]
    };
    
    jsPlumb.addEndpoint(blockID, { 
        anchors:["Left","Top"],
        isTarget: true,
        maxConnections: 1
    }, common);
    
    $(block).click(function() {
         blockSelection = [];
         displayExpression(blockID);
    });
    
    jsPlumb.draggable(blockID, {containment: 'parent'});

}

// Given a block, traverse the tree that ends with that block
// And return the corresponding s-expression
var tokenList = {};
function getExpression(blockID) {
    var connections = jsPlumb.getConnections({ target:blockID });
    var op;
    if (connections.length>0) {
        if (blockID==='end') {
            op = getExpression(connections[0].sourceId);        
        }
        else {
            var exp = $('#'+blockID).triggerHandler('expression');
            if (exp == "setq") {
                if (!tokenList[blockID]) {
                    op = [exp,blockID];
                    for (var i =0; i<connections.length; i++) {
                        // alert(blockID+' '+i+' '+JSON.stringify(result));
                        op[i+2] = getExpression(connections[i].sourceId);
                    }
                    tokenList[blockID] = op;
                    // alert(JSON.stringify(tokenList));
                }
                op = blockID;
            }
            else {
                op = [exp];
                for (var i =0; i<connections.length; i++) {
                    // alert(blockID+' '+i+' '+JSON.stringify(result));
                    op[i+1] = getExpression(connections[i].sourceId);
                }
            }
        }
    }
    else {
        // 'trgger' in JQuery calls the event but returns the JQuery object to which the trigger applied
        // triggerHandler calls the actual handling function, without any cascading of the event, and so
        // returns the actual return of the function.
        op = $('#'+blockID).triggerHandler('expression');
    }
    // alert(blockID+' '+JSON.stringify(op));
    return op; 
}

// output function to view the expression for a block
function displayExpression(blockID) {
    tokenList = {};
    var exp = getExpression(blockID);
    // alert(JSON.stringify(tokenList));
    if (Object.keys(tokenList).length === 0) {
        debugMsg("No tokens");
        result = exp;
    } else {
        debugMsg("Some tokens");
        var result = [];
        for (var i in tokenList) {
            result.push(tokenList[i]);
        }
        result.push(exp);
    }
    $('#s-exp').val(JSON.stringify(result));
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
