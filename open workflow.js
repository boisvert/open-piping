/*

(plus 2 3) in JSON = ["plus", 2, 3]

(1 2 3) in JSON = [1, 2, 3]

Examples of expression that ought to be interpretable:

[
  ["defun", "square", ["x"], ["times", "x", "x"]],
  ["square", 2]
]

result:
   function square(x) { return x*x; }
   square(2);

[
  ["defun", "fac", ["n"], ["if", ["lt", "n", 2], 1, ["times", "n", ["fac", ["minus", "n", 1]] ]]],
  ["fac", 10]
]

result:
   function fac(n) {return lt(n,2)?1:times(n,fac(n-1));}
   fac(10);

*/

// Set of predefined functions
// predefined functions both define the gui blocks
// and this compilation, so the functions are loaded in the editor

// as well as functions, some substititions should be allowed, e.g. like below.
// this is still in progress.
// a call is either substitution or function, not both;
// substitutions may have prerequisite functions; should it have prerequisite substitutions?
// var substitutions = {
//    plus: {replace:"$1 + $2"},
//    triple: {replace:"times($1,3)", requires:["times"]},
//    if: {replace: "$1?$2:$3;"}
// }
// substitutions could uncoupling language specific structures
// and replace special cases of the compiler engine
// like conditionals and possibly function definition
//
// a set of defined vars (setq) also needed

var code; // code of functions to include in result
var counted; // list of functions in use (to not repeat them)
var tokens; // list of variables in use (to parse them)

function compile(Exp) {
   code = "// Automatic generated code \n\n";
   counted = [];
   tokens = [];
   var call = encode(Exp);
   code += "process("+call+");";
  // alert(process(call));
   return code;
}

function encode(Exp) {
    var res;

    if (Exp instanceof Array) {
    // case 1: expression is an empty array
        if (Exp.length==0) res = [];
        else { // non-empty array
            var H = Exp[0];
    // case 2: expression is a function definition
            if (H == "defun") {
                res = defun(Exp);
            }
    // case 3: expression is an if statement
            else if (H == "if") {
                res = conditional(Exp);
            }
            else if (H in predefined_functions) {
    // case 4: expression is a function call
                // getOperator returns the string defining the function
                op = getOperator(H);
                code += op;
                Exp.shift();
                // should there be validation on number and type of arguments?
                Arguments = Exp.map(encode);
                res = H+"("+Arguments.join(",")+")";
            } else
    // case 5: expression is any other array - treated like a data array
                res = "["+Exp.map(encode)+"]";
        }
    }
    else if (isString(Exp)) {
    // case 6: expression is a known variable
        if (tokens.indexOf(Exp) >=0) res = Exp
    // case 7: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 8: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;
    
    // done
    return res;
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// the syntax is javascript: funtion foo(arguments) {return body;}
function defun(Exp) {
    // adds a function definition to the "predefined functions" JSON list
    var name = Exp[1];
    var args = Exp[2].join(", ");
    var f = {};
    f["args"] = args;
    predefined_functions[name] = f;
    counted.push(name);
    // tokens and arguments are thee same in this simplified system
    tokens = args; // for (var i=args.length; i>0; i--) {tokens.push(args[i-1]);}
    // alert(tokens);
    var body = "return "+encode(Exp[3])+";";
    f["body"] = body;
    tokens = []; // if we use seta/setq, shift needed to manage the list
    code += "function "+ name + "(" + args + ") {" + body +"}\n\n";
}

// conditional returns the code for a conditional execution

// works for javascript syntax
function conditional(Exp) {
    // adds a function definition to the "predefined functions" JSON list
    var condition = encode(Exp[1]);
    var iftrue = encode(Exp[2]);
    var iffalse = encode(Exp[3]);
    return "("+ condition + ")?(" + iftrue + "):(" + iffalse +")";
}

function process(Exp) {
   // calls the compiled instructions, respecting the structure, and returns a string to display.
   
    var res;

    if (Exp instanceof Array) {
        res = Exp.map(process);
    }
    else {
        res = eval(Exp);
        if (typeof(res == "undefined")) res = Exp;
    }
    // done
    return res;
    
}

function getOperator(X) {
    var o = '';
    
    if (counted.indexOf(X) === -1) {
        fX = predefined_functions[X];
        counted.push(X);
        // concatenate function definition
        o = "function "+ X + "(" + fX.args + ") {" + fX.body +"}\n\n";
        if (fX.requires) {
            var pre = fX.requires.map(getOperator);
            code += pre.join("");
        }
    }
    
    return o;
}

function isString(s) {
   return (typeof s === 'string' || s instanceof String)
}