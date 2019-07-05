/*
Set of predefined functions 
predefined functions both define the gui blocks
and this compilation, so the functions are loaded in the editor

as well as functions, some substititions are allowed
a call is either substitution or function;
substitutions may have prerequisite functions; but not prerequisite substitutions (?)
substitutions could uncoupling language specific structures
and replace special cases of the compiler engine
like conditionals and possibly function definition

A stack of defined vars (setq) is also maintained
*/

// String with the resulting code
// plus simple encapsulated functions

var predefined_functions = {},
    predefined_replacements = {};

//$(loadDefinitions);

/*
function loadDefinitions() {
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
}
*/

function codeString() {
    this.text = "";
	this.level = 0;
}

codeString.prototype = {
	nl: "\n\n",
    clear: function() {
		this.text = "";
		this.level = 0;
	},
    line: function(lin) {
		lin = " ".repeat(this.level)+lin;
		this.text += lin + this.nl;
	},
	nest: function() {
		this.level += 3;
	},
	denest: function() {
		if (this.level>=3) this.level-=3;
	}

}

String.prototype.repeat = String.prototype.repeat || function(n){
  n= n || 1;
  return Array(n+1).join(this);
}

String.prototype.replaceAll = String.prototype.replaceAll || function(search, replacement) {
    const target = this;
    return target.split(search).join(replacement);
};

String.prototype.unescape = function() {
    const target = this;
    return target //.replaceAll('\\n','\n').replaceAll('\\t','\t').replaceAll('\\\\','\\');
};


var globalCode = new codeString();

// list of functions in use (to not repeat them)
// this is the "d-list" of defined functions in LISP interpreters
var includedFunctions = {
    list: [],
    clear: function() { 
        includedFunctions.list=[];
        return includedFunctions;
    },
    notContain: function(F) {
        return includedFunctions.list.indexOf(F) === -1;
    },
    add: function (F) {
        includedFunctions.list.push(F);
        return includedFunctions;
    }
}

// list of tokens (variables) in use, to parse them
// with encapsulated functions for handling the list
var tokens = {
    list: [],

    clear: function() {
        tokens.list=[];
        return tokens;
    },

    contain: function(tok) {
        return tokens.list.indexOf(tok)>=0;
    },

    add: function (tok) {
        tokens.list.unshift(tok);
        return tokens;
    },

    addAll: function (toks) {
        debugMsg(toks); 
        toks.map(tokens.add)
    },

    remove: function (tok) {
        if (tokens.contain(tok)) {
            return false;
        } else {
            tokens.list.splice(list.indexOf(tok),1)
            return tokens;
        }
    },

    removeAll: function (toks) {
        toks.map(tokens.remove);
    },

    shift: function (n) {
        if (!n) n=1;
        do {tokens.list.shift();} while (n-->0);
        return tokens;
    }
};

// list of substitutions already parsed
const readyReplacements = {
    list: [],
    clear: function() { 
        readyReplacements.list=[];
        return readyReplacements;
    },
    contain: function(X) {
        return readyReplacements.list.indexOf[X] >= 0;
    },
    set: function (X,R) {
        readyReplacements.list[X] = R;
        return readyReplacements;
    },
    get: function (X) {
        if (readyReplacements.contain(X))
            return readyReplacements[X];
        else
            return false;        
    }
}

/*
The "process" needs rethinking
Some wrapper object that limits the scope of needed functions
secures the execution and provides support e.g. display, timing, execution journal 
*/
function compile(Exp) {
   includedFunctions.clear();
   tokens.clear();
   readyReplacements.clear();
   globalCode.clear();
   globalCode.line("// Automatically generated code");
   const call = encode(Exp,globalCode);
   globalCode.line("function pipe() { return "+call+"; }");
   return globalCode.text;
}

function encode(Exp,vars) {
    var res;

    if (isArray(Exp)) {
    // cases 1 to 6 - Exp is an array
        res = encodeArray(Exp,vars);
    }
    else if (isString(Exp)) {
    // case 7: expression is a known variable
        if (tokens.contain(Exp)) res = Exp;
	/* old approach 
    // case 7.5 (ahem...) - expression is a function being given as parameter
	    else if(Exp.indexOf('\\') == 0) {
			res = Exp.substring(1);
			getOperator(res); 
		}
	*/
    // case 8: expression is a string
        else res = '"'+Exp+'"';
    }
    // case 9: expression is anything else - left unprocessed - works for number, boolean, null
    else res = Exp;

    // done
    return res;
}

// "call_fn": {"args": "f, arr", "body":"var fn=window[f]; return fn.apply(this,arr);"},


/*

[block,x]
	si x est une fonction	
      -- ajouter x aux fonctions en usage
	si x est un remplacement
	  -- ajouter x = (arg1, ...) => (...) -- exemple plus = (a,b) => (a+b);
	retourner x
*/


function encodeArray(Exp, vars) {

    var res = null;
    // case 1: expression is an empty array
    if (Exp.length==0)
        res = '[]';
    else
    // Cases 2-6: non-empty array 
    {
        var H = Exp[0]; // take the head
        var choice = caseOfHead(H);

        if (choice==2)
        //  case 2: Exp is a data array
            res = '['+encodeEach(Exp,vars)+']';
        else
        {
            Exp.shift(); // keep all but the head

        // case 3: expression is a function definition
            if (choice==3) {
                defun(Exp[0],Exp[1],Exp[2]);
				res = encode(Exp[3],vars);
            }
        // case 4: expression is a variable setting
            else if (choice==4) {
                var tok = Exp[0];
                tokens.add(tok);
				res = tok;
                vars.line("var "+tok+" = "+encode(Exp[1])+";");
            }
		// case 4.2: (yeah, well...) expression is a block (function or replacement) reference
			else if (choice==4.2){
				H = Exp[0]; // block name
				debugMsg(Exp, "is block", H);
				enforce(H, isString); // must be a string: it's a function call (!)
				if ((H in predefined_functions) || tokens.contain(H)) {
					getOperator(H); 
					res = H;
				}
				//	H is a replacement... TBC
				else if (H in predefined_replacements) {
					// replacement: adapt getOperator to create an anon. function (a) => op(a)
					debugMsg(H,"is predefined, ");
					res = getSubstitutor(H);
					var s = predefined_replacements[H].args;
					const args = predefined_replacements[H].args.split(',');
					res = "("+ s + ")=>"+res(args);
				}
				else
				    throw "Block requires a block name";				
			}
        // case 4.5: expression is a higher order function (x->y)->z
            else if (choice==4.5) {
				const Arguments = encodeEach(Exp,vars);
				H = Arguments[0]; // new head
				debugMsg("apply",H);
				enforce(H, isString); // must be a string: it's a function call (!)
 				Arguments.shift(); // rest are arguments
				 if (H.indexOf(")=>(")>-1) { //	H is a replacement (anon function)
					res = "("+H+").apply(this,"+Arguments+")";
				}
				else if ((H in predefined_functions) || tokens.contain(H))
				{
					// NOT FINISHED if H is a token, we resolve it,
					// but also we need to find and process the prerequisite functions
					res = H+".apply(this,"+Arguments+")";
				}
				else {
				    throw "Apply requires a block";				
				}
			}
        // case 5: predefined_replacements
            else if (choice==5) {
                var s = getSubstitutor(H);
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp,vars);
                res = s(Arguments);
            }
        // case 6: expression is a function call
            else if (choice==6) {
                // getOperator returns the string defining the function
                var op = getOperator(H);
                // should there be validation on number and type of arguments?
                Arguments = encodeEach(Exp,vars);
                res = op(Arguments); //H+"("+Arguments.join(",")+")";
            } // case 6
        } // cases 3-6
    } // cases 2-6 (non-empty array)

    return res;
}

function caseOfHead(H) {
   if (H=="defun") return 3; //function definition
   if (H=="setq") return 4; // variable
   if (H=="block") return 4.2; // variable
   if (H=="apply") return 4.5; // call a function [ higher order type: (x -> y) -> z ]
   if (H in predefined_replacements) return 5; // JSON replacement
   if (H in predefined_functions) return 6; // JSON function
   return 2; // anything else - data array
}

function encodeEach(E,vars) {
    enforce(E, isArray);
    debugMsg("encoding each of",E, E.length);
    var Res = [];
    if (E.length>0) {
        debugMsg("encoding "+E[0]);
        var First = encode(E[0],vars);
        E.shift();
        var Res = encodeEach(E,vars);
        if (First === null) {
			debugMsg("tokens - not added to exec");
		}
		else {
			Res.unshift(First);
		}
    }
   return Res;
}

// defun adds necessary code for the function definition and updates the list of functions available
// and the list of functions in use
// the syntax is javascript: funtion foo(arguments) {return body;}
function defun(name,args,body) {
    // adds a function definition to the "predefined functions" JSON list
    var f = {};
    f["args"] = args.join(", ");
    predefined_functions[name] = f;
    includedFunctions.add(name);
    tokens.addAll(args); // tokens list is filled with the function arguments
	var vars = new codeString();
	vars.line("function "+ name + "("+ f["args"] + ") {");
    debugMsg(tokens);
    vars.line("return "+encode(body,vars)+";");
	vars.line("}");
	debugMsg("defun",vars.text);
    f["body"] = vars.text+" "+body;
    tokens.removeAll(args);
    globalCode.line(vars.text);
}

/*
TODO: replacement object
===
+ready bool false // flag - true once preprocessing has been done
+definition JSON {args:"", js:""} // from JSON file
+argIndexes Array [] // of integers, the index of each argument to use
+resultParts Array [] // of strings, the code to use in between arguments
===
getSubstitutor
process
startswithwhich

*/

function getSubstitutor(X) {
    var s;
    
    if (readyReplacements.contain(X)) {
        s = readyReplacements.get(X);
    }
    else {
        rX = predefined_replacements[X];

        // parse rX.args and get strings to replace in the substitution
        args = rX.args.split(',').map($.trim);
        
        // then parse rX.js - get the substrings that start with substitutions
        reps = rX.js.split('@');
        
        // each string in reps (bar the first) starts with one of the strings in args
        // indexes is a list e.g. [0,1,2] of which argument, by number, must be inserted
        var indexes = [];
        // results_parts is a list of strings that need to be concatenated
        var result_parts = [reps[0]]; // ['','?',':',''] ;

        for (var i=1; i<reps.length; i++) {
            ind = startsWithWhich(args, reps[i]); // find the index of the argument to use next
            indexes.push(ind); // add to indexes array
            res_part = reps[i].slice(args[ind].length); // find the next substring
            result_parts.push(res_part);
        }

        // return a function that makes the subtitition
        // the function uses indexes and results_parts which are in its environment
        // (thank you closure!)
        s = function(bits) {
                var res = '(';
                for (var i=0; i<indexes.length; i++) {                
                    res += result_parts[i]+bits[indexes[i]];
                }
                res += result_parts[i] + ')';
                return res;
            };
        // add prerequisites to the code
        if (rX.requires) {
            var pre = rX.requires.map(getOperator);
            globalCode.line(pre.join(""));
        }

        readyReplacements.set(X,s);
    }

    return s;
}

function getOperator(X) {
    
    if (includedFunctions.notContain(X)) {
        fX = predefined_functions[X];
        includedFunctions.add(X);

        // concatenate function definition
        globalCode.line("function "+ X + "(" + fX.args + ") {" + fX.body +"}");

        // find pre-requisites
        if (fX.requires) {
            fX.requires.map(getOperator);
        }
    }
    
    return function (Args) {return X+"("+Args.join(",")+")";};
}

/*
function process(Exp) {
   // calls the compiled instructions, respecting the structure, and returns a string to display.
   
    debugMsg('processing ', Exp);
    var res;

    if (isArray(Exp)) {
        res = Exp.map(process);
    }
    else if(isString(Exp)) {
        debugMsg('processing a string ',Exp)
        res = Exp;
    }
    else {
        res = eval(Exp);
        if (typeof(res == "undefined")) res = Exp;
    }
    // done
    return res;

}*/


// start with which takes a list of tokens and a string to check.
// It returns the index of the token with which the string starts
// if the string starts with none of them, it returns undefined.
function startsWithWhich(toks, str) {
    for (var which=0; which<toks.length; which++) {
        if (str.indexOf(toks[which])==0) {
            return which;
        }
    }
    debugMsg('Not found any "'+toks+'" in "'+str+'"');
    return undefined;
}

// crude type checking
// there is a type checking library that would be more appropriate
function enforce(X,check) {
    if (!check(X))
        throw JSON.stringify(X,null,3)+" fails the check "+check;
}

function isString(s) {
   return (typeof s === 'string' || s instanceof String);
}

function isArray(a) {
   return (typeof a === 'array' || a instanceof Array);
}

function debugMsg() {
    if (debugMode) { // set debugMode to true to turn on debugging
        const m = [];
		const seen = [];
        for (i in arguments) {
			const a = arguments[i];
			if (a != null && typeof a == "object")
            m.push(JSON.stringify(a, function(key, val) {
				//if (val != null && typeof val == "object") {
					if (seen.indexOf(val) >= 0) {
						return "_seen";
					}
					seen.push(val);
				//}
				return val;
			}
			),3);
			else m.push(a);
        }
        console.log(m.join(" "));
    }
}

jsPlumb.ready(function() {
	// load js
	debugMsg("load js interpretation data");
	$.ajax({
		url: "js_blocks.json",
		beforeSend: function(xhr){
			if (xhr.overrideMimeType) {
				xhr.overrideMimeType("application/json");
			}
		},
		success: function(json) {
			debugMsg("found js data",json);
			predefined_functions = json.functions;
			predefined_replacements = json.replace;
		},
		error: function(_, status, err) {debugMsg(status+'\n'+err);}
	});
});

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

=============
   
[
  ["defun", "fac", ["n"], ["if", ["lt", "n", 2], 1, ["times", "n", ["fac", ["minus", "n", 1]] ]]],
  ["fac", 10]
]

result:
   function fac(n) {return lt(n,2)?1:times(n,fac(n-1));}
   fac(10);
   
====== map defined from "apply" ====

["apply", "plus", [1, 2]]

result:
   plus(1,2);
   function plus(a,b) {return a+b;}

===

(defun
    map
    (f arr) 
    (if (empty arr)
	    ()
	    (concat
    		(apply
			    f
		        ((first arr))
		    )
			(map f (rest arr))
	    )
    )
)

===

definition of map - result

function map(f,arr) {
   return (empty(arr))?[]:concat(f(first(arr)),map(f,rest(arr)));
}

================ example of map =============

[
  ["defun", "map",
            ["f", "arr"],
            ["if", ["isEmpty", "arr"],
                   [],
                   ["cons",
                         ["apply", "f", [["first", "arr"]] ],
                         ["map", "f", ["rest", "arr"] ]
                   ]
            ]
  ],
  ["map", "\\isNumber", [1,2,3,"a","b","c"] ]
]

// works in js (June 2017)
// result:

// Automatically generated code

function isEmpty(a) {return $.isArray(a) && a.length==0;}

function cons(elt,list) {list.unshift(elt);return list;}

function map(f, arr) {
   return isEmpty(arr)?[]:cons(f.apply(this,[arr[0]]),map(f,arr.slice(1)));
}

function isNumber(n) {return $.isNumeric(n);}

function main() { return map(isNumber,[1,2,3,"a","b","c"]); }

*/

