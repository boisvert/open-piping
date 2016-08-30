
// i: used to define a unique ID for blocks dragged to the canvas
var i = 1;

// position of blockType for the new block being brought in
var oldPos;

// currently selected block(s)
var blockSelection = [];

jsPlumb.ready(function() {
    // initialise with block types to the left
    addBlockType("plus", {top:10,left:10}, 2 );
    addBlockType("Number value", {top:70,left:10} );
    endBlock(); // marks the result of the function

    // drag and drop blocks
    $( ".blockType" ).draggable({
        start: function( event, ui) {
            oldPos = $(this).position();
        },
        stop: function( event, ui ) {
            var blockType = $(this).attr("id");
            if (!$(this).attr("inConn")) {
                addBlock(blockType,ui.position);
            }
            else {
                addBlock(blockType,ui.position,$(this).attr("inConn"));
            }
            $(this).css(oldPos);
        }
    });
    
    // delete selected block
    $('html').keyup(function(e){
        if(e.keyCode == 46) {
            while (blockSelection.length>0) {removeBlock(blockSelection[0]);}
        }
    });
    
});

// block functions - add, select, deselect, remove, blocktype, endblock - are messy
// project for a rainy day: to group these functions into an encapsulated object
// for clarity and better reusability

// inConn is the number of input connections accepted (ie of parameters for function)
function addBlock(label, position, inConn) {
    var blockID = 'id-'+i;
    var block = $('<div>').attr('id',blockID).addClass('block').html(label);
    if(position) {
        block.css(position);
    }
    
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
        anchor:"Right",
        isSource: true
    }, common); 
    
    if (inConn) {
        jsPlumb.addEndpoint(blockID, { 
            anchors:["Left","Top"],
            isTarget: true,
            maxConnections: inConn
        }, common);
    }
    
    jsPlumb.draggable(blockID, {containment: 'parent'});
    
    $(block).click(function() {
         blockSelection = [];
         selectBlock(block);
         displayExpression(blockID);
    });
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

// create block type - ie the source of a function to drag in and use
// inConn is the number of input connections accepted (ie of parameters for function)
function addBlockType(label,position, inConn) {
    var block = $('<div>').attr('id',label).addClass('blockType').html(label);
    if (inConn) {
        $(block).attr('inConn',inConn);
    }
    if (position) {
        block.css(position);
    }
    $('#pipeContainer').append(block);
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
function getExpression(blockID) {
    var connections = jsPlumb.getConnections({ target:blockID });
    var op;
    if (connections.length>0) {
        if (blockID==='end') {
            op = getExpression(connections[0].sourceId);        
        }
        else {
            op = [$('#'+blockID).text()];
            for (var i =0; i<connections.length; i++) {
                // alert(blockID+' '+i+' '+JSON.stringify(result));
                op[i+1] = getExpression(connections[i].sourceId);
            }
        }
    }
    else {
        op = $('#'+blockID).text();
    }
    // alert(blockID+' '+JSON.stringify(op));
    return op;
}

// output function to view the expression for a block
function displayExpression(blockID) {
    var exp = JSON.stringify(getExpression(blockID));
    $('#s-exp').val(exp);
}
