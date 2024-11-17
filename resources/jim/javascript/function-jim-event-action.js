/*!
 * Copyright 2013 Justinmind. All rights reserved.
 */

(function(window, undefined) {
  var $simulation = jQuery("#simulation"), dragZIndex = 3;

  function parseSVG(svg, $target, args){
	  $target = $("#" + $target.attr('id'));
      var id = $target.prop("id");
	    var overlay = $target.attr("overlay");
	    if (args.aspectratio == undefined || !args.aspectratio == "true") svg = svg.replace("<svg", "<svg preserveAspectRatio='none'");
	    svg = svg.replace(/(\.[a-z0-9A-Z\-_]+\s*\{)/g, "#" + id + " " + "$1");

	    if ($target.prop("tagName") == "IMG") {
		  $target.parent().append("<div id='"+ id +"' class='" + $target.prop("class") +
								"' alt='" + $target.prop("alt") + "' style='" +
								$target.attr("style") + "' overlay='"+ ((overlay != undefined) ? overlay : "none") + "'>");
		  $target.remove();
		  $target = $("#"+ id);
	    }

	    $target.html("<div class=\"backgroundLayer\"></div>" + svg);
	    $target.data(data);
	    // $target.attr("systemname", value);

	    if (overlay != undefined && overlay != "none" && overlay != "") jimUtil.changeSVGColor($target, overlay);
  }
  
  function getUniqueSelector(node) {
	var path;
	while (node.length) {
		var realNode = node[0], name = realNode.nodeName;
		if (!name) break;
		name = name.toLowerCase();

		var parent = node.parent();

		var siblings = parent.children(name);
			if (siblings.length > 1) { 
            name += ':eq(' + siblings.index(realNode) + ')';
        }

        path = name + (path ? '>' + path : '');
        node = parent;
    }

    return path;
  }
  
  function interpolateValue(start, end, progress) {
	if (typeof start == 'number')
		return start + (end - start) * progress;
	return undefined;
  }
  
  function wrapValues(variables) {
	  var newValues = new Array(variables.length);
	  for (var i = 0; i < variables.length; ++i)
		  newValues[i] = variables[i];
	  
	  return newValues;
  }
  
  function getColorToGradientProgressFunction(item, oldColorRGB, newGradient, invert) {
	  
	return function (progress) {
		var hexRegexp = /#[a-fA-F0-9]+/g;
		var currentValue = newGradient;
		
		var newText = jimUtil.replaceGradientColors(currentValue, function(match) {
			var rgb = jimUtil.cssToRgb(match);
			var r = interpolateValue(oldColorRGB.r, rgb.r, invert ? (1 - progress) : progress);
			var g = interpolateValue(oldColorRGB.g, rgb.g, invert ? (1 - progress) : progress);
			var b = interpolateValue(oldColorRGB.b, rgb.b, invert ? (1 - progress) : progress);	
			
			if (rgb.a != undefined || oldColorRGB.a != undefined) {
				var a = interpolateValue(
					oldColorRGB.a == undefined ? 1 : oldColorRGB.a, 
					rgb.a == undefined ? 1 : rgb.a,
					invert ? (1 - progress) : progress);
				return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
			}
				
			return "#" + jimUtil.toHex(r) + jimUtil.toHex(g) + jimUtil.toHex(b);
		});
		
		item.css("background-image", newText);
	}
  }

  function getSVGChangeOpacityProgressFunction(svg, endOpacity) {
  	var startOpacityList = [];
  	var paths = svg.find("use").not("defs *");

  	jQuery.each(paths, function(index, value) {
  		var entry = { item : $(value), endOpacity: endOpacity};
  		var startOpacity = $(value).attr("opacity");
  		if (startOpacity == undefined || startOpacity == "none") {
  			startOpacity = "1.0";
  		}
  		entry.startOpacity = startOpacity;
  		startOpacityList.push(entry);
  	});

  	return function (progress) {
  		for (var i = 0; i < startOpacityList.length; ++i) {
  			var entry = startOpacityList[i];
  			var currentOpacity = interpolateValue(parseFloat(entry.startOpacity), parseFloat(entry.endOpacity), progress);
  			$(entry.item).attr("opacity", currentOpacity.toString());
  		}
  	}
  }

  function getSVGChangeStrokeWidthProgressFunction(svg, endWidth) {
  	var startWidthList = [];
  	endWidth = parseFloat(endWidth.replace('px', ''));
  	var paths = svg.find("path, rect, circle, ellipse, line, polyline, polygon, use").not("defs *");

  	jQuery.each(paths, function (index, value) {
		var node = $(value);
		var startWidth = node.css("stroke-width");
		var entry = { item : node, endStrokeWidth: endWidth};
		
		if (startWidth != undefined && startWidth != "none") {
			startWidth = parseFloat(startWidth.replace('px', ''));
			entry.startStrokeWidth = startWidth;
		}
		
		startWidthList.push(entry);
	});

  	return function (progress) {
		for (var i = 0; i < startWidthList.length; ++i) {
			var entry = startWidthList[i];
			
			if (entry.startStrokeWidth != undefined) {
				var currentWidth = interpolateValue(entry.startStrokeWidth, entry.endStrokeWidth, progress);
				
				jimUtil.changeSVGStrokeWidth(entry.item, currentWidth);
			}
		}
	};
  }

  function getSVGChangeBackgroundOpacityProgressFunction(svg, endOpacity) {
  	var startOpacityList = [];
  	endOpacity = parseFloat(endOpacity.replace('px', ''));
  	var paths = svg.find("path, rect, circle, ellipse, line, polyline, polygon, use").not("defs *");

  	jQuery.each(paths, function (index, value) {
			var node = $(value);
			var startOpacity = node.css("fill-opacity");
			var entry = { item : node, endBackgroundOpacity: endOpacity};
			
			if (startOpacity != undefined && startOpacity != "none") {
				startOpacity = parseFloat(startOpacity.replace('px', ''));
				entry.startBackgroundOpacity = startOpacity;
			}
			
			startOpacityList.push(entry);
		});
		return function (progress) {
		for (var i = 0; i < startOpacityList.length; ++i) {
				var entry = startOpacityList[i];
				
				if (entry.startBackgroundOpacity != undefined) {
					var currentOpacity = interpolateValue(entry.startBackgroundOpacity, entry.endBackgroundOpacity, progress);
					
					jimUtil.changeSVGFillOpacity(entry.item, currentOpacity);
				}
			}
		};
  }
  
  function getSVGChangeColorProgressFunction(svg, endColor, changeBorder, changeBackground) {
	var endRGB = endColor == null ? undefined : jimUtil.hexToRgb(endColor);
	var startColorList = [];
	var overlay = svg.closest("div").attr("overlay");
	var paths = svg.find("path, rect, circle, ellipse, line, polyline, polygon, use").not("defs *");
	var fromOverlay = (endColor == null || endColor == undefined) && overlay != undefined && overlay != "none";
	var overlayRGB;
		
	if (fromOverlay) {
		jimUtil.removeSVGColor(svg);
		overlayRGB = jimUtil.hexToRgb(overlay);
	}
	
	jQuery.each(paths, function (index, value) {
		var node = $(value);
		var startStroke = node.css("stroke");
		var startFill = node.css("fill");
		var entry = { item : node, endStroke: endRGB, endFill: endRGB };
		
		if (startStroke != undefined && startStroke != "none" && changeBorder) {
			startStroke = jimUtil.cssToRgb(startStroke);
			entry.startStroke = fromOverlay ? overlayRGB : startStroke;
			
			if (fromOverlay)
				entry.endStroke = startStroke;
		}
		
		if (startFill != undefined && startFill != "none" && changeBackground) {
			startFill = jimUtil.cssToRgb(startFill);
			entry.startFill = fromOverlay ? overlayRGB : startFill;
			
			if (fromOverlay)
				entry.endFill = startFill;
		}
		
		startColorList.push(entry);
	});
	
	if (fromOverlay) {
		jimUtil.changeSVGColor(svg, overlay);
	}
	  
	return function (progress) {
		for (var i = 0; i < startColorList.length; ++i) {
			var entry = startColorList[i];
			
			if (entry.startStroke != undefined && changeBorder) {
				var r = interpolateValue(entry.startStroke.r, entry.endStroke.r, progress);
				var g = interpolateValue(entry.startStroke.g, entry.endStroke.g, progress);
				var b = interpolateValue(entry.startStroke.b, entry.endStroke.b, progress);	
				
				var currentHex = "#" + jimUtil.toHex(r) + jimUtil.toHex(g) + jimUtil.toHex(b);
				jimUtil.changeSVGStrokeColor(entry.item, currentHex);
			}

			if (entry.startFill != undefined && changeBackground) {
				var r = interpolateValue(entry.startFill.r, entry.endFill.r, progress);
				var g = interpolateValue(entry.startFill.g, entry.endFill.g, progress);
				var b = interpolateValue(entry.startFill.b, entry.endFill.b, progress);
				
				var currentHex = "#" + jimUtil.toHex(r) + jimUtil.toHex(g) + jimUtil.toHex(b);
				jimUtil.changeSVGFillColor(entry.item, currentHex);
			}
		}
	};
  }

  function changeSvgProperty(obj, cssAttrName, value, animated, attributes, targetEntry) {
  	var paths = obj.find("path, rect, circle, ellipse, line, polyline, polygon, use").not("defs *");
  	if ((value != "none" || cssAttrName == "path-filter") && value != "") {
  		if (cssAttrName == "path-stroke") {
  			if (animated) {
				(function (elem, newColor) {									
					targetEntry.manualStepFunctions.push(getSVGChangeColorProgressFunction(elem, value, true, false));
					targetEntry.completeFunctions.push( function () {
						if (newColor == undefined)
							jimUtil.removeSVGColor($(obj))
						else {
							jQuery.each(paths, function (index, objValue) {
								jimUtil.changeSVGStrokeColor(objValue, newColor);	
							});
						}
					});
				})($(obj), value); 				
  			}
  			else {
  				jQuery.each(paths, function (index, objValue) {
					jimUtil.changeSVGStrokeColor(objValue, value);	
				});
			}
  		}
  		else if (cssAttrName == "path-stroke-width") {
  			if (animated) {
  				(function (elem, newWidth) {									
			  		targetEntry.manualStepFunctions.push(getSVGChangeStrokeWidthProgressFunction(elem, value));
			  		targetEntry.completeFunctions.push( function () {
						if (newWidth != undefined) {
							jQuery.each(paths, function (index, objValue) {
								jimUtil.changeSVGStrokeWidth(objValue, newWidth);
							});
				  		}
			  		});
				})($(obj), value);
  			}
  			else {
  				jQuery.each(paths, function (index, objValue) {
					jimUtil.changeSVGStrokeWidth(objValue, value);
				});
  			}
  		}
  		else if (cssAttrName == "path-stroke-dasharray") {
  			var strokeWidth = 1;
  			var uses = obj.find("use");
        	jQuery.each(uses, function(index, useValue) {
	          	var strokeWidthString = $(useValue).attr("stroke-width");
		        strokeWidthString = strokeWidthString.replace('px', '');
		        strokeWidth = parseFloat(strokeWidthString);
       		});

       		if (animated) {
       			(function (elem, newValue) {									
			  		targetEntry.completeFunctions.push( function () {
						if (newValue != undefined) {
							jQuery.each(paths, function (index, objValue) {
								jimUtil.changeSVGStrokeDashArray(objValue, newValue, strokeWidth);
							});
				  		}
			  		});
				})($(obj), value);
       		}
       		else {
	       		jQuery.each(paths, function (index, objValue) {
	       			jimUtil.changeSVGStrokeDashArray(objValue, value, strokeWidth);
	       		});
       		}
  		}
  		else if (cssAttrName == "path-background-color") {
  			if (animated) {
  				(function (elem, newColor) {									
				  targetEntry.manualStepFunctions.push(getSVGChangeColorProgressFunction(elem, value, false, true));
				  targetEntry.completeFunctions.push( function () {
					if (newColor == undefined)
					  	jimUtil.removeSVGColor($(obj))
					else {
					  	jQuery.each(paths, function (index, objValue) {
					  		if ($(objValue).attr("fill") == undefined || ($(objValue).attr("fill") != undefined && !$(objValue).attr("fill").includes("url")))
								jimUtil.changeSVGFillColor(objValue, newColor);
						});
					}
				  });
				})($(obj), value);
  			}
  			else {
  				jQuery.each(paths, function (index, objValue) {
  					if ($(objValue).attr("fill") == undefined || ($(objValue).attr("fill") != undefined && !$(objValue).attr("fill").includes("url")))
						jimUtil.changeSVGFillColor(objValue, value);
				});
  			}
  		}
  		else if (cssAttrName == "path-background-opacity") {
  			if (animated) {
  				(function (elem, newOpacity) {									
			  		targetEntry.manualStepFunctions.push(getSVGChangeBackgroundOpacityProgressFunction(elem, value));
			  		targetEntry.completeFunctions.push( function () {
						if (newOpacity != undefined) {
							jQuery.each(paths, function (index, objValue) {
								jimUtil.changeSVGFillOpacity(objValue, newOpacity);
							});
				  		}
			  		});
					})($(obj), value);
  			}
  			else {
  				jQuery.each(paths, function (index, objValue) {
  					if ($(objValue).attr("fill-opacity") == undefined || ($(objValue).attr("fill-opacity") != undefined && !$(objValue).attr("fill-opacity").includes("url")))
						jimUtil.changeSVGFillOpacity(objValue, value);
					});
  			}
  		}
  		else if (cssAttrName == "path-background-image") {
  			if (animated) {
  				(function (elem, newValue) {									
			  		targetEntry.completeFunctions.push( function () {
						if (newValue != undefined) {
							jQuery.each(paths, function (index, objValue) {
								jimUtil.changeSVGBackgroundImage(objValue, newValue, attributes["path-background-image-width"], attributes["path-background-image-height"], attributes["path-background-size"], attributes["path-background-position-x"], attributes["path-background-position-y"]);
							});
				  		}
			  		});
				})($(obj), value);
  			}
  			else jimUtil.changeSVGBackgroundImage(obj, value, attributes["path-background-image-width"], attributes["path-background-image-height"], attributes["path-background-size"], attributes["path-background-position-x"], attributes["path-background-position-y"]);
  		} else if (cssAttrName == "path-filter") {
			jQuery.each(paths, function (index, objValue) {
				jimUtil.changeSVGFilter(objValue, value);
			});
			} else if (cssAttrName == "opacity") {
				if (animated) {
					(function (elem, newValue) {
						targetEntry.manualStepFunctions.push(getSVGChangeOpacityProgressFunction(elem, value));									
			  		targetEntry.completeFunctions.push( function () {
						if (newValue != undefined) {
							jimUtil.changeSVGOpacity(elem, newValue);
				  		}
			  		});
					})($(obj), value);
				}
				else {
					jimUtil.changeSVGOpacity(obj, value);
				}
			}
			else if (cssAttrName == "stroke-cap") {
				jQuery.each(paths, function (index, objValue) {
					jimUtil.changeSVGStrokeCap(objValue, value);
				});
			}
  	}
  }
  
  jQuery.extend(jimEvent.fn, {
    "jimNavigation": function(args) {
      var historyEntry;
      if(args.isbackward) {
        historyEntry = urlHistory.getPrev() || jimMain.getMainWindow().urlHistory.getActive();
        args.target = historyEntry.url;
        jimMain.navigate(args);
      } else if(args.forward) {
        historyEntry = urlHistory.getNext() || jimMain.getMainWindow().urlHistory.getActive();
        args.target = historyEntry.url;
        jimMain.navigate(args);
      } else if(args.target) {
        jimMain.navigate(args);
      }
      if(args.isscenario && !args.tab){
    	  $("#scenarioTab").trigger("click");
    	  if(jimScenarios.currentNode != -1){
    		  jimScenarios.deleteFilter();
    	  }
      }
    },
    "jimCreateDrag": function(drag, $target, args) {
      var self = this, $drag, $master, position, dragData, dragTargets;

      if($target.jimGetType() === itemType.panel) {
        $target = $target.parent();
      }
      if($target.jimGetType() === itemType.ellipse ||
    		  $target.jimGetType() === itemType.triangle ||
    		  $target.jimGetType() === itemType.callout) {
          $target = $target.closest("svg");
        }
		
	  var isRelative = jimUtil.isRelative($target);
	  var relativeBounds = isRelative ? jimUtil.getRelativeItemBounds($target) : undefined;

      var posType = $target.css("position");
      var posTop = isRelative ? relativeBounds.y : $target.css("top");
      var posLeft = isRelative ? relativeBounds.x : $target.css("left");
      var isContainedInCC = false;

      $master = $target.parents(".master");
      if($master.length !== 0) {
        $target.wrap("<div id='" + $master.attr("id") + "' class='" + $master.attr("class").split(" ")[0] + "' />");
        $target = $target.parent();
        isContainedInCC=true;
      }

      var $parent = $target.parent().closest(".firer");

      position = $target.jimPosition();
      dragData = {
        "parent": $parent,
        "isContained": args.containment,
        "top": position.top,
        "left": position.left,
        "containedInCC" : isContainedInCC,
        "startposition": {
          "type": posType,
          "top": posTop,
          "left": posLeft,
          "index": $target.index()
        }
      };

      var wrapper = $target.closest(".layout.horizontal");
	  var oldParent = $target.parent();
	  var maxIndex = Math.max(dragZIndex,$target.css('z-index'));
	  if(maxIndex==dragZIndex)
       dragZIndex++;
      $target.appendTo($target.parents(".template, .screen"))
             .css({"position": "absolute", "top": dragData.top, "left": dragData.left, "z-index": maxIndex+1})
             .data("jimDrag", dragData);
			 
	  if (oldParent.is(".relativeLayoutWrapperResponsive"))
	    oldParent.parent().remove();
			 
	  if (isRelative)
		jimUtil.moveRelativeItemChilds($target, {x : dragData.left - posLeft, y : dragData.top - posTop});

	  if (wrapper.hasClass(".verticalWrap")) jimUtil.wrapVerticalLayout(wrapper);
	  else if (wrapper.attr("hspacing") != 0 || wrapper.attr("vspacing") != 0) jimUtil.wrapHorizontalLayout(wrapper);

      $drag = jQuery(drag); /* $drag and $target might not be the same (multidrag) */
      dragTargets = jimUtil.exists($drag.data("jimDragTargets")) ? $drag.data("jimDragTargets") : [];
      dragTargets.push($target);
      $drag.data("jimDragTargets", dragTargets);

      return dragData;
    },
    "jimRestoreDrag": function($drag) {
      var dragTargets, $target, dragData, i, iLen;
      dragTargets = $drag.data("jimDragTargets");
      if(dragTargets) {
	    for(i=0, iLen=dragTargets.length; i<iLen; i+=1) {
	      $target = jQuery(dragTargets[i]);
	      dragData = $target.data("jimDrag");
	      if(dragData && dragData.isContained) {
	        jimUtil.insertInto({"target": $target, "parent": $(dragData.parent)});
	      }
	    }
      }
    },
    "jimDestroyDrag": function($drag) {
      var dragTargets, i, iLen;
      dragTargets = $drag.data("jimDragTargets");
      if(dragTargets) {
        for(i=0, iLen=dragTargets.length; i<iLen; i+=1) {
          jQuery(dragTargets[i]).removeData("jimDrag");
        }
        $drag.removeData("jimDragTargets");
      }
    },
    "jimMove": function(args, callback) {
      if(jimUtil.exists(args)) {
        var self = this, $targets, t, tLen, $target, eventData, dragData, position, newTopPosition, newLeftPosition, $parent, containment, $svg, effect, top, left, topPinOffset, leftPinOffset;
        var CCWrapper=true;
        var properties = {};
        $targets = self.getEventTargets(args.target);
        for(t=0, tLen=$targets.length; t<tLen; t+=1) {
          $target = jQuery($targets[t]);
          if($target.length) {
            var topType = args.top.type;
            var leftType = args.left.type;

            //exception for drag and drop (find another way)
            $master = $target.parents(".master");
            if($master.length !== 0 && (topType=="movewithcursor" || leftType=="movewithcursor")) {
              $target = $master;
            }
            $parentFirer = $target.parent().closest(".firer");
            while ($parentFirer.is(".group"))
            	$parentFirer = $parentFirer.parent().closest(".firer");
			$parent = jimUtil.getParentToInsert($parentFirer);

            eventData = self.event.data;
            effect = jimUtil.createAnimationOptions(args.effect, callback);

            if(topType=="movewithcursor" || leftType=="movewithcursor") {
              dragData = $target.data("jimDrag");
	          if(!jimUtil.exists(dragData)) {
	            dragData = self.jimCreateDrag(eventData.target, $target, args);
	          }
	          if (args.containment){
	            $parentFirer = dragData.parent;
	            while ($parentFirer.is(".group"))
            		$parentFirer = $parentFirer.parent().closest(".firer");
				$parent = jimUtil.getParentToInsert($parentFirer);
			  }
            }
            if(topType=="movetodragstart" || leftType=="movetodragstart") {
          	  dragData = $target.data("jimDrag");
              if(jimUtil.exists(dragData)) {
                if(dragData.containedInCC && CCWrapper) {
            	  /*destroy wrapper*/
            	  $target = $target.children();
            	  $target.unwrap();
            	  /*get target again with a different selector*/
            	  $target = self.getEventTarget(args.target);
            	  $parentFirer = $target.parent().closest(".firer");
            	  CCWrapper=false;
                }

				jQuery.extend(properties, {"top": "auto"});
                jQuery.extend(properties, {"left": "auto"});
                jQuery.extend(properties, {"type": dragData.startposition.type});
                jimUtil.insertInto({"target": $target, "parent": $(dragData.parent), "position":properties, "checkIntersect":false});
              }
            }

            var leftPinned = leftType.indexOf("pin")>=0;
            var topPinned = topType.indexOf("pin")>=0;
            var currentLeftPinned = jimPin.getHorizontalPin($target)!=="none";
            var currentTopPinned = jimPin.getVerticalPin($target)!=="none";
            var currentPinned = currentTopPinned || currentLeftPinned;
            if(topType == "nomove" && currentTopPinned)
            	topPinned = true;
            if(leftType == "nomove" && currentLeftPinned)
            	leftPinned = true;
            var pinned = topPinned || leftPinned;

            if(currentPinned && $target.hasClass("pin-translated")){
            	//return to fixed
            	jimPin.refreshPinElement($target);
            }

            position = $target.position();
            position.top = position.top + parseInt($target.css("margin-top"),10);
            position.left = position.left + parseInt($target.css("margin-left"),10);
			
			if (!leftPinned)
				position.left = parseFloat($target.css("left")) + parseInt($target.css("margin-left"),10);
			if (!topPinned)
				position.top = parseFloat($target.css("top")) + parseInt($target.css("margin-top"),10);
			
			var relativeBounds = {};
			if ($target.is('.group')) {
				relativeBounds = jimUtil.getRelativeItemBounds($target);
				position.left = relativeBounds.x;
				position.top = relativeBounds.y;
			}

            if(!currentPinned && pinned && !jimPin.isJSPin($target) && args.effect){
	            //not pinned element going to be pinned
	            //pin in origin to animate
		    	var transPos = jimPin.translateAbsoluteToFixed($target,position.top,position.left);
		    	transPos.top = transPos.top - jimPin.getLayoutMarginTop();
		    	transPos.left = transPos.left - jimPin.getLayoutMarginLeft();
		    	jimPin.addHorizontalClass($target,"beginning");
		    	jimPin.addVerticalClass($target,"beginning");
		    	jimPin.pinElement($target,transPos.left,transPos.top);
		    	position = transPos;
            }

            /*position TOP*/
            switch(topType) {
	          case "movewithcursor":
		        position = {
		     	  "top": dragData.top
		        };
		        if(dragData.insertInto){
		    	  position.top -= dragData.insertInto.jimPosition().top;
		        }
	            newTopPosition = position.top + (eventData.deltaY*(1/jimUtil.getTotalScale()));
	            break;
	          case "movetodragstart":
	            newTopPosition = dragData.startposition.top;
	            break;
	          case "movebyoffset":
	            position.top += $target.parent().scrollTop();

			    newTopPosition = position.top + parseInt(self.evaluateExpression(args.top.value),10);
	            break;
	          case "movetoposition":
	          case "exprvalue":
	            newTopPosition = parseInt(self.evaluateExpression(args.top.value),10);
	            break;
	          case "pinbeginning":
	          case "pincenter":
	          case "pinend":
	            newTopPosition = parseInt(self.evaluateExpression(args.top.value),10);
	            topPinOffset = newTopPosition;

	            //calculate position for animation
            	var topPinClass = topType.substring(3);
            	newTopPosition = jimPin.calculateAbsoluteTop($target,newTopPosition,topPinClass,"fixed");
            	jimPin.addVerticalClass($target,topPinClass);

	        	break;
	          case "nomove":
	        	break;
            }
						
            if(jimUtil.exists(newTopPosition) && !isNaN(parseInt(newTopPosition, 10))) {
	          if (args.containment) {
	            var parentPositionTop = 0;
	            /*move with cursor*/
	            if($parentFirer.get(0) !== $target.parent().closest(".firer").get(0))
	        	  parentPositionTop = $parent.jimPosition().top;
	            containment = {
	              "top": parentPositionTop + parseInt($parent.css("border-top-width"),10) + parseInt($parent.css("padding-top"),10),
	              "bottom": parentPositionTop + $parent.innerHeight() - $target.jimOuterHeight() + parseInt($parent.css("border-top-width"),10)
	            };
	            if ($target.is('.group'))
	            	containment.bottom = parentPositionTop + $parent.innerHeight() - relativeBounds.height + parseInt($parent.css("border-top-width"),10);
	            newTopPosition = Math.min(containment.bottom, Math.max(containment.top, newTopPosition));
	          }

	          //pin conversions
	          if(!topPinned && (currentPinned || pinned)){
	          		if(topType == "movebyoffset"){
	          			if(!currentTopPinned){
	          				topPinOffset = jimPin.translateFixedToAbsolute($target,newTopPosition,0).top;
	          			}
	          			else{
	          				//calculate corresponding pin margin
	          				topPinOffset = jimPin.getVerticalMargin($target, parseInt(self.evaluateExpression(args.top.value),10), jimPin.getVerticalPin($target));
	          				pinned=true;
	          				topPinned=true;
	          			}
	          		}
	          		else if(topType == "movetoposition" || topType == "exprvalue"){
		          		topPinOffset = newTopPosition;
		          		if(!jimPin.isJSPin($target))
		          			newTopPosition = jimPin.translateAbsoluteToFixed($target,newTopPosition,0).top;
	          		}
	          	}
		        if((pinned || currentPinned) && topType !== "nomove"){
		        	jQuery.extend(properties, {"margin-top": 0,"margin-bottom":0});
		        }
		        if(!topPinned){
	            	jimPin.removeVerticalClass($target);
	            }

	          jQuery.extend(properties, {"top": newTopPosition});
            }
            else{
            	if(!currentPinned)
            		jimPin.removeVerticalClass($target);
            }

            /*position LEFT*/
            switch(leftType) {
	          case "movewithcursor":
	            position = {
	              "left": dragData.left
	            };
		        if(dragData.insertInto){
		    	  	position.left -= dragData.insertInto.jimPosition().left;
		        }
	            newLeftPosition = position.left + (eventData.deltaX*(1/jimUtil.getTotalScale()));
	            break;
	          case "movetodragstart":
	            newLeftPosition = dragData.startposition.left;
	            break;
	          case "movebyoffset":
			    position.left += $target.parent().scrollLeft();

			    newLeftPosition = position.left + parseInt(self.evaluateExpression(args.left.value),10);
	            break;
	          case "movetoposition":
	          case "exprvalue":
	            newLeftPosition = parseInt(self.evaluateExpression(args.left.value), 10);
	            break;
	          case "pinbeginning":
	          case "pincenter":
	          case "pinend":
	          	newLeftPosition = parseInt(self.evaluateExpression(args.left.value), 10);
	            leftPinOffset = newLeftPosition;

            	var leftPinClass = leftType.substring(3);
            	newLeftPosition = jimPin.calculateAbsoluteLeft($target,newLeftPosition,leftPinClass,"fixed");
            	jimPin.addHorizontalClass($target,leftPinClass);

	        	break;
	          case "nomove":
	        	break;
            }

            if(jimUtil.exists(newLeftPosition) && !isNaN(parseInt(newLeftPosition, 10))) {
	          if (args.containment) {
	            var parentPositionLeft = 0;
	            /*move with cursor*/
	            if($parentFirer.get(0) !== $target.parent().closest(".firer").get(0))
	        	  parentPositionLeft = $parent.jimPosition().left;
	            containment = {
	              "left": parentPositionLeft + parseInt($parent.css("border-left-width"),10) + parseInt($parent.css("padding-left"),10),
		          "right": parentPositionLeft + $parent.innerWidth() - $target.jimOuterWidth() + parseInt($parent.css("border-left-width"),10)
	            };
	            if ($target.is('.group'))
	            	containment.right = parentPositionLeft + $parent.innerWidth() - relativeBounds.width + parseInt($parent.css("border-left-width"),10);
	            newLeftPosition = Math.min(containment.right, Math.max(containment.left, newLeftPosition));
	          }

	          if(!leftPinned && (currentPinned || pinned)){
	          		if(leftType == "movebyoffset"){
	          			if(!currentLeftPinned)
	          				leftPinOffset = jimPin.translateFixedToAbsolute($target,0,newLeftPosition).left;
	          			else{
	    	            	//calculate corresponding pin margin
	    	            	leftPinOffset = jimPin.getHorizontalMargin($target, parseInt(self.evaluateExpression(args.left.value),10), jimPin.getHorizontalPin($target));
	    			    	pinned=true;
	    			    	leftPinned=true;
	          			}
	          		}
	          		else if(leftType == "movetoposition" || leftType == "exprvalue"){
		          		leftPinOffset = newLeftPosition;
		          		if(!jimPin.isJSPin($target))
		          			newLeftPosition = jimPin.translateAbsoluteToFixed($target,0,newLeftPosition).left;
	          		}
	          	}
	            if((pinned || currentPinned) && leftType !== "nomove"){
		        	jQuery.extend(properties, {"margin-right":0,"margin-left":0});
		        }
	            if(!leftPinned){
	            	jimPin.removeHorizontalClass($target);
	            }

	          jQuery.extend(properties, {"left": newLeftPosition});
	        }
            else{
            	if(!currentPinned)
            		jimPin.removeHorizontalClass($target);
            }
			
	        if(args.effect){
	        	effect.complete = function(){
	        			if(pinned){
			 	       	   jimPin.pinElement($target,leftPinOffset,topPinOffset, false, {lostPinLeft: currentLeftPinned && !leftPinned,
																			 lostPinTop: currentTopPinned && !topPinned});
			 	       	   jimPin.resetScrollDirection();
	        			}
	        			else if(currentPinned){
				 	    	jimPin.unpinElement($target);
	        			}

		 			    jimUtil.calculateMinSize($target);
		 			    jimUtil.refreshPageMinSizeWithTarget($target);
						jimUtil.refreshEventResponsiveLayoutItem($target);
						jimResponsive.refreshResponsiveComponents($target);

		 	    	   callback();
		 	       }
	        	if($target.hasClass("group") || $target.hasClass("masterinstance")){
	        		effect.progress = function(){
	        			jimPin.refreshGroup($target);
	        			jimPin.resetScrollDirection();
	        		}
	        	}
	        }

	        //apply pin
	        if(leftPinOffset!==undefined){
	        	$target.data("offsetX",leftPinOffset);
	        	$target.removeData("originPinRightOffset");
	        }
	        else if(properties.left!==undefined){
	        	$target.data("offsetX",properties.left);
	        	$target.removeData("originPinRightOffset");
	        }

	        leftPinOffset = $target.data('offsetX');

	        if(topPinOffset!==undefined){
	        	$target.data("offsetY",topPinOffset);
	        	$target.removeData("originPinTopOffset");
	        }
	        else if(properties.top!==undefined){
	        	$target.data("offsetY",properties.top);
	        	$target.removeData("originPinTopOffset");
	        }

	        topPinOffset = $target.data('offsetY');

	        if(args.effect)
			  if ($target.is(".group")) {
				var offset = {x : newLeftPosition - relativeBounds.x, y : newTopPosition - relativeBounds.y};
				offset.x = isNaN(offset.x) ? 0 : offset.x;
				offset.y = isNaN(offset.y) ? 0 : offset.y;
				jimUtil.moveRelativeItemChilds($target, offset, effect);
			  } else 
			    $target.animate(properties, effect);
		    else {
			  if ($target.is(".group")) {
				var offset = {x : newLeftPosition - relativeBounds.x, y : newTopPosition - relativeBounds.y};
				offset.x = isNaN(offset.x) ? 0 : offset.x;
				offset.y = isNaN(offset.y) ? 0 : offset.y;
				jimUtil.moveRelativeItemChilds($target, offset);
			  } else 
			    $target.css(properties);
			}

	        if(!args.effect && !jQuery.isEmptyObject(properties)){
	        	if(pinned) {
					jimPin.pinElement($target, leftPinOffset, topPinOffset, false, {lostPinLeft: currentLeftPinned && !leftPinned,
																			 lostPinTop: currentTopPinned && !topPinned});
	        	}
	        	else if(currentPinned)
	        		jimPin.unpinElement($target);
	        	else{
		        	if($target.hasClass("group") || $target.hasClass("masterinstance")){
		        		jimPin.refreshGroup($target);
	        		}
	        	}
	        	jimPin.resetScrollDirection();
	        }

		    if(topType=="movewithcursor" || leftType=="movewithcursor")
		      self.triggerDragOver($target);

		    var vWrap = $target.closest(".layout.horizontal");
		    if(vWrap.length > 0 && (topType=="movetodragstart" || leftType=="movetodragstart")) {
			  $target.css({"position": "", "top": "", "left": "", "display" : ""});
			  jimUtil.wrapLayout($target);
		    }

		    if(!args.effect){
			    jimUtil.calculateMinSize($target);
				jimUtil.refreshEventResponsiveLayoutItem($target);
			    jimUtil.refreshPageMinSizeWithTarget($target);
                jimResponsive.refreshResponsiveComponents($target);
		    }
		  }
		}
		if(callback && !args.effect) { callback(); }
	  }
    },
    "jimInsert": function(args, callback) {
      if(jimUtil.exists(args) && jimUtil.exists(args.target)) {
        var self = this, $target, $parent, dragData, t, $targets, tLen;
        $targets = self.getEventTargets(args.target);
        for(t=0, tLen=$targets.length; t<tLen; t+=1) {
          $target = jQuery($targets[t]);
		  var oldMasterInstance = $target.closest(".masterinstance");
          $parent = self.getEventTarget(args.parent);

          if ($parent.length > 1) {
        	  var dataParent = $target.parent().closest(".datarow, .gridcell");
        	  if (dataParent.length) {
        	  	var trueParent = null;
        	  	for (var p = 0; p < $parent.length; p += 1) {
        	  	  var parentParent = $($parent.get(p)).parent().closest(".datarow, .gridcell");
        	  	  if (parentParent.attr("id") == dataParent.attr("id"))
        	  		trueParent = $($parent.get(p));
        	  	}
        	  	if (trueParent != null)
        	  	  $parent = trueParent;
        	  }
          }

          if($parent.hasClass("scrollable")){
	          jimPin.translateAllFixedToAbsolute($target);
          }

          if(jimUtil.exists($target) && jimUtil.exists($parent)) {
            switch(self.event.type) {
              case "dragend":
                jimUtil.insertInto({"target": $target, "parent": $parent, "event": self.event});
                break;
              default:
                jimUtil.insertInto({"target": $target, "parent": $parent});
                break;
            }
          }
          var vWrap = $target.closest(".layout.horizontal");
          if (vWrap.length > 0) {
            if (dragData && vWrap.hasClass("verticalWrap")) $target.css({"position": "", "top": "", "left": "", "display" : ""});
              jimUtil.wrapLayout($target);
          }


          if($target.hasClass("pin"))
          	jimPin.refreshPinElement($target);
          else if($target.hasClass("group")) {
			jimUtil.insertRelativeItemIntoLayout($parent, $target, jimUtil.getRelativeItemBounds($target));
	      }

	      if($parent.attr('id') == "alignmentBox"){
	    	  jimPin.resetScrollDirection();
	      }

          jimResponsive.refreshResponsiveComponents($target);
		  if (oldMasterInstance != undefined && oldMasterInstance.length > 0)
			jimResponsive.refreshResponsiveComponents(oldMasterInstance);
          jimUtil.refreshPageMinSizeWithTarget($target);
        }
        if(callback) { callback(); }
      }
    },
    "jimShow": function(args, callback) {
      var self = this, t, $targets, tLen, options;
      if(jimUtil.exists(args) && jimUtil.exists(args.target)) {
      	$targets = self.getEventTargets(args.target);
        for(t=0, tLen=$targets.length; t<tLen; t+=1) {
    	  /*exception: groups have no z-index*/
    	  var $target = jQuery($targets[t]);
    	  /*if panel is target and already visible, transitions won't work as promises don't fire back.*/
    	  var samePanel = false;
		  switch($target.jimGetType()) {
            case itemType.panel:
			  var activePanel = $target.parent().find(":visible");
			  if($(activePanel).is($target)) {
			    samePanel = true;
			    if(callback) { callback(); }
			  }
			  break;
		  }

		  if(!samePanel) {
    	    if($target.hasClass("group")) {
    		  $target.css("z-index","2");
            }
            switch($target.jimGetType()) {
              case itemType.panel:
              	if ($target.css("mix-blend-mode") != undefined)
              		$target.parent().css("mix-blend-mode", $target.css("mix-blend-mode"));
                $target.trigger("panelactive");
                break;
            }
			
			if (jimUtil.isRelative($target) && $target.parent().is(".relativeLayoutWrapperResponsive")) {
				$target.parent().parent().removeClass("hidden");
				$target.parent().parent().show();
			}

            if(args.effect){
            	if(t==tLen-1)
                	options = jimUtil.createUIEffectOptions(args.effect,callback);
                else
                	options = jimUtil.createUIEffectOptions(args.effect);

            	var isHidden = $target.hasClass("hidden"); // Fix for show animations on horizontal layouts
            	$target.removeClass("hidden");

            	$target.show();
	            jimUtil.calculateMinSize($target);
				jimUtil.refreshEventResponsiveLayoutItem($target);
	            var pinnedElements = jimPin.translateAllFixedToAbsolute($target);
				var isWrapped = $target.closest(".ui-effects-wrapper").length != 0;
				
				if (!isWrapped)
	              $target.hide();
	            if(pinnedElements.length>0)
	          	  jimPin.resetScrollDirection();

				if (!isWrapped)
	              $target.hide().show(options);
			    else
				  $target.show(options);
            }
            else{
				if(!args.transition)
					$target.removeClass("hidden");
				else {
					if($target.find(".image.lockV.percentage, .image.lockH.percentage").length>0)
						jimResponsive.refreshResponsiveComponents($target);
         		}
				
            	jimUtil.show($target, args).done(function() {
            		if($target.hasClass("group")){
            			$target.css("z-index","");
            		}
            		jimUtil.refreshPageMinSizeWithTarget($target);
					jimUtil.refreshEventResponsiveLayoutItem($target);
					jimResponsive.refreshResponsiveComponents($target);
					
					if (callback && args.transition)
						callback();
            	});
            	jimUtil.wrapLayout($target, $target);
            }
		  }
        }
        if(callback && !args.effect && !args.transition) { callback(); }
      }
    },
    "jimHide": function(args, callback) {
      if(jimUtil.exists(args) && jimUtil.exists(args.target)) {
        var self = this, $targets, $target, t, tLen, $tree, options;

        $targets = self.getEventTargets(args.target);
        if(jimUtil.exists($targets)) {
          for(t=0, tLen=$targets.length; t<tLen; t+=1) {
            $target = jQuery($targets[t]);

            if($target.jimGetType() === itemType.panel) {
              break;
            }
            if(args.effect) {
              /* TODO: add .stop() to interrupt animation */
               if(t==tLen-1)
            	options = jimUtil.createUIEffectOptions(args.effect,callback);
               else
            	options = jimUtil.createUIEffectOptions(args.effect);

              var layoutComplete = function () {
				  jimUtil.wrapLayout($target);
				  if (jimUtil.isRelative($target) && $target.parent().is(".relativeLayoutWrapperResponsive"))
					$target.parent().parent().hide();
				
				  jimUtil.refreshPageMinSizeWithTarget($target);
				  jimUtil.refreshEventResponsiveLayoutItem($target, false);
			  };
              if (!options.hasOwnProperty("complete")) jQuery.extend(options, {"complete": layoutComplete});
              else setTimeout(layoutComplete, options["duration"] + 100);

              jimUtil.calculateMinSize($target);
              var pinnedElements = jimPin.translateAllFixedToAbsolute($target);
              if(pinnedElements.length>0)
            	  jimPin.resetScrollDirection();		  

			  $target.hide(options);
            } else {
			  if (jimUtil.isRelative($target) && $target.parent().is(".relativeLayoutWrapperResponsive"))
				  $target.parent().parent().hide();
              $target.hide();
            }
            /* start special component behavior */
            jQuery($target + "-submenu").hide();
            $tree = ($target.hasClass("tree")) ? $target : $target.parents(".tree");
            if($tree.length) {
              jQuery.fn.jimTree.update($tree);
            }
            /* end special component behavior */
          }
        }

        jimUtil.refreshPageMinSizeWithTarget($target);
		jimUtil.refreshEventResponsiveLayoutItem($target, false);
        if (!args.effect) jimUtil.wrapLayout($target);
        if(callback && !args.effect) { callback(); }
      }
    },
    "jimChangeStyle": function(args, callback) {
      if(args) {
        var self = this, s, sLen, style, t, tLen, target, $target, expression, bShape, shapeStyle, calculatedValue;
		
		var styleChanges = [];
		var effects = null;
		
		for(s=0, sLen=args.length; s<sLen; s+=1) {
			var map = args[s];
			
			if (map.effect != null)
				effects = map.effect;
			else styleChanges.push(map);
		}
		
		var animated = effects != null;
		var targets = {};
		
        for(s=0, sLen=styleChanges.length; s<sLen; s+=1) {
          style = styleChanges[s];
          shapeStyle = styleChanges[s];
          for(t=0, tLen=style.target.length; t<tLen; t+=1) {
            target = style.target[t];
            $target = self.getEventTarget(target);
            if($target) {
              bShape=false;
              if($target.jimGetType() === itemType.shapewrapper) {
                if(target.startsWith("#shapewrapper") || "opacity" in shapeStyle.attributes || "filter" in shapeStyle.attributes) {
                  bShape=true;
                } else {
                  $target = $target.find(".shape");
                }
              }
              if(typeof shapeStyle.attributes == 'undefined') {
                shapeStyle.attributes = {};
              }
              if(typeof shapeStyle.expressions == 'undefined') {
                shapeStyle.expressions = {};
              }
				
			  var selector = getUniqueSelector($target);
				
			  if (targets[selector] == undefined)
				targets[selector] = {stepFunctions : [], completeFunctions: [], properties : {}, manualStepFunctions: [], item : $target};
			  var targetEntry = targets[selector];

              if(style.attributes) {
                var borderColorsChanged = [];
                var borderStylesChanged;
                for(attribute in style.attributes) {
                  if(style.attributes.hasOwnProperty(attribute)) {
                    calculatedValue = style.attributes[attribute];
                    if(attribute==="width" || attribute==="height" || attribute==="stroke-dasharray") {
                      calculatedValue = (isNaN(parseInt(style.attributes[attribute], 10))) ? eval(style.attributes[attribute]) : style.attributes[attribute];
					  if (typeof(calculatedValue) == "number")
						calculatedValue += "";
                    }
                    shapeStyle.attributes[attribute] = calculatedValue;
                    try {
                   	  var i=attribute.indexOf('#');
                      var cssAttrName=attribute;
                      if(i!=-1) {
                    	cssAttrName=attribute.substring(0,i);
                   	  }

                      if($target.closest(".firer").is(".datagrid") && (cssAttrName==="padding-left" || cssAttrName==="padding-top") && target.endsWith("> table")) {
                    	var $datagrid = $target.closest(".firer");
						targetEntry.properties[cssAttrName] = calculatedValue;

                    	if(cssAttrName==="padding-left"){
                    	  $datagrid.attr("hSpacing", calculatedValue);
                    	}
                    	if(cssAttrName==="padding-top"){
                    	  $datagrid.attr("vSpacing", calculatedValue);
                    	}
						  
						(function(dg) {
						  targetEntry.completeFunctions.push(function () {dg.dataview("updateDataGridBounds")});
						})($datagrid);
                      } else {
	                    var domObject=$target.get(0);
	                    if(domObject.css2svg && domObject.css2svg[attribute] != undefined) {
						  if (animated) {
						    targetEntry.properties[attribute] = calculatedValue;
							(function (dO, initialValue, finalValue, currentAtt) {
							  targetEntry.manualStepFunctions.push( function (step) {
							    var currentValue = interpolateValue(initialValue, finalValue, step);
								dO.css2svg[currentAtt] = currentValue;
							  });
							})(domObject, domObject.css2svg[attribute], parseFloat(calculatedValue), attribute);
						  } else 
							domObject.css2svg[attribute]=calculatedValue;
	                    } else {
	                      if (cssAttrName == "overlay") {
	                    	if (calculatedValue != "none" && calculatedValue != "") {
							  if (animated) {
								(function (elem, newColor) {									
								  targetEntry.manualStepFunctions.push(getSVGChangeColorProgressFunction(elem, calculatedValue, true, true));
								  targetEntry.completeFunctions.push( function () {
									if (newColor == undefined)
									  jimUtil.removeSVGColor($target)
									else
									  jimUtil.changeSVGColor(elem, newColor) 
								  });
								})($target, calculatedValue);
							  } else jimUtil.changeSVGColor($target, calculatedValue);
	                    	} else jimUtil.removeSVGColor($target);
	                      }
	                      // path borders & backgrounds
	                      else if (jimUtil.isPathProperty(cssAttrName) || (cssAttrName == "opacity" && $target.jimGetType() == itemType.path)) {
	                      	changeSvgProperty($target, cssAttrName, calculatedValue, animated, style.attributes, targetEntry);
	                      }
	                      else {
	                    	var oldBackgroundImage = $target.css("background-image");
							  
							if (cssAttrName == "background-color" && (oldBackgroundImage.indexOf("linear-gradient") == 0 || oldBackgroundImage.indexOf("radial-gradient") == 0)) { 
							  // GRADIENT TO COLOR
							  targetEntry.manualStepFunctions.push(getColorToGradientProgressFunction($target, jimUtil.cssToRgb(calculatedValue), $target.css("background-image"), true));
								
							  (function(element, currentAttr, newValue) {
								targetEntry.completeFunctions.push(function () {
								  element.css(currentAttr, newValue);
								});
							  })($target, cssAttrName, calculatedValue);
								
							} else if (cssAttrName == "background-image" && (calculatedValue.indexOf("linear-gradient") == 0 || calculatedValue.indexOf("radial-gradient") == 0)) {
							  // COLOR TO GRADIENT
							  var gradientWidth = $target[0].offsetWidth, gradientHeight = $target[0].offsetHeight;
							  var $shapeWrapper = $target.closest(".shapewrapper");
							  if ($shapeWrapper.length) {
								var shapeSVG = $shapeWrapper.find(".shape");
								var borderWidth = (shapeSVG[0].css2svg && shapeSVG[0].css2svg["border-width"]) ? shapeSVG[0].css2svg["border-width"] : 0;
								var bounds = shapeSVG[0].getBoundingClientRect();
								gradientWidth = bounds.width - borderWidth * 2;
								gradientHeight = bounds.height - borderWidth * 2;
							  }
							  
							  calculatedValue = jimUtil.translateJimGradientToCSS(calculatedValue, gradientWidth, gradientHeight);
								
							  if ($target.css("background-image").indexOf("linear-gradient") < 0 && $target.css("background-color") != "rgba(0, 0, 0, 0)")
								targetEntry.manualStepFunctions.push(getColorToGradientProgressFunction($target, jimUtil.cssToRgb($target.css("background-color")), calculatedValue, false));
								
							  if ($target.css("background-image").indexOf("linear-gradient") == 0)
								$target.css(cssAttrName, calculatedValue);
								
							  (function(element, currentAttr, newValue) {
								targetEntry.completeFunctions.push(function () {
								  element.css(currentAttr, newValue);
								});
							  })($target, cssAttrName, calculatedValue);
							} else if (cssAttrName != "filter") {
							  if (typeof calculatedValue === 'string' && (calculatedValue.indexOf("linear-gradient") == 0 || calculatedValue.indexOf("radial-gradient") == 0)) {
								var gradientWidth = $target[0].offsetWidth, gradientHeight = $target[0].offsetHeight;
							    var $shapeWrapper = $target.closest(".shapewrapper");
							    if ($shapeWrapper.length) {
								  var shapeSVG = $shapeWrapper.find(".shape");
								  var borderWidth = (shapeSVG[0].css2svg && shapeSVG[0].css2svg["border-width"]) ? shapeSVG[0].css2svg["border-width"] : 0;
								  var bounds = shapeSVG[0].getBoundingClientRect();
								  gradientWidth = bounds.width - borderWidth * 2;
								    gradientHeight = bounds.height - borderWidth * 2;
							    }
								calculatedValue = jimUtil.translateJimGradientToCSS(calculatedValue, gradientWidth, gradientHeight);
							  }
								  
							  targetEntry.properties[cssAttrName] = calculatedValue;
							  if (cssAttrName.indexOf("border") !== -1) {
								if(cssAttrName.indexOf("color") !== -1)
								  borderColorsChanged.push(cssAttrName);
								else if(cssAttrName.indexOf("style") !== -1)
								  borderStylesChanged =true;
							  }
							}
							
							//BACKGROUND IMAGE or EFFECTS CHANGE NOT ANIMATED - fix
							if ((cssAttrName == "background-image" && $target.hasClass("imageLayer")) ||
								(cssAttrName == "filter")){
							  (function(element, currentAttr, newValue) {
								targetEntry.completeFunctions.push(function () {
								  element.css(currentAttr, newValue);
								});
							  })($target, cssAttrName, calculatedValue);
							}

							if(cssAttrName==="background-color" || cssAttrName==="background-image") {
							  (function(element, currentAttr, oldImage) {
								targetEntry.completeFunctions.push(function () {
								  jimUtil.fixBackgroundImageAttr(element, currentAttr, oldImage);
								});
							  })($target, cssAttrName, oldBackgroundImage);
							}
							  
                    	  }
	                    }
                      }
                    } catch (error) {
                      jimUtil.debug(error);
                    }
                  }
                } 

                if(borderColorsChanged && !borderStylesChanged) {
				  (function(elem, borderColors) {
					targetEntry.completeFunctions.push(function () {
					  jimUtil.borderColorsChanged(elem, borderColors)
					});
				  })($target, borderColorsChanged);
				}

                if($target.is(".borderLayer") && ($target.closest(".firer").is(".table") || $target.closest(".firer").is(".datalist") || $target.closest(".firer").is(".datagrid"))) {
				  (function(elem) {
					targetEntry.completeFunctions.push(function () {jimUtil.resizeTable(elem.closest(".firer"))});
				  })($target);
				}
                  
                if (style.hasOwnProperty("html")) {
				  (function(elem, baseTarget) {
					targetEntry.completeFunctions.push(function () {elem.closest("div").html(style[baseTarget]["html"])});
				  })($target, target);
                }

              }
 
			  try {
                for(expression in style.expressions) {
                  if(style.expressions.hasOwnProperty(expression)) {
                    try {
                      calculatedValue = (isNaN(parseInt(style.expressions[expression], 10))) ? eval(style.expressions[expression]) : style.expressions[expression];
					  targetEntry.properties[expression] = calculatedValue;
                      shapeStyle.attributes[expression] = calculatedValue;
                    } catch (error) {
                      jimUtil.debug(error);
                    }
                  }
                }
              } catch(e) {
                jimUtil.debug(e); 
              }
				
              if($target.is(".datagrid")) {
                $target.dataview("updateDataGridBounds");
              }
              jimUtil.forceReflow();
              if(bShape || $target.closest(".shapewrapper").length > 0) {
                if(!bShape)
                  $target = $target.closest(".shapewrapper").find(".shape");
                $target.each(function() {
               	  var shapeSVG = this;
                  var styles = shapeStyle;
                  if($(this).jimGetType() === itemType.shapewrapper) {
                    shapeSVG = $(this).find(".shape")[0];
                    styles = {"attributes" : {}, "expressions" : {}};
                  }
					
				  if (animated) {
					(function(svg) {
					  var shapeProgress = function (targetValue) {
					    var progressStyles = { "attributes" : {}, "expressions" : {} };
					    for (attName in targetValue.properties) {
						  progressStyles.attributes[attName] = targetValue.item.css(attName);
					    }
					    jimShapes.updateStyle(svg, progressStyles);
					  };
					  targetEntry.stepFunctions.push(shapeProgress);
					})(shapeSVG);
				  }
					
				  (function(svg, styleList) {
					targetEntry.completeFunctions.push(function() { jimShapes.updateStyle(svg, styleList) });
				  })(shapeSVG, styles);
                });
              }
            }
          }
        }
		
		var entries = Object.entries(targets);
		if (animated) {
		  for (var index = 0; index < entries.length; ++index) {
			var value = entries[index][1];
			var animationOptions = jimUtil.createAnimationOptions(effects);
				
			(function(styleEntry) {
			  jQuery.extend(animationOptions, {"complete" : function () {
				for (var i = 0; i < styleEntry.completeFunctions.length; ++i)
				  styleEntry.completeFunctions[i]();
						
				  if (callback)
					callback();
			  },
			  "progress" : function (promise, progress, remainingMs) {
				for (var i = 0; i < styleEntry.manualStepFunctions.length; ++i)
				  styleEntry.manualStepFunctions[i](progress);
				for (var i = 0; i < styleEntry.stepFunctions.length; ++i)
				  styleEntry.stepFunctions[i](styleEntry);
			  }});
					
			  if (jQuery.isEmptyObject(styleEntry.properties))
				$({foo:0}).animate({foo:100}, animationOptions);
			  else styleEntry.item.animate(styleEntry.properties, animationOptions);
			})(value);
		  }
		} else {			
		  for (var index = 0; index < entries.length; ++index) {
			var value = entries[index][1];
			value.item.css(value.properties);
				
			for (var i = 0; i < value.completeFunctions.length; ++i)
			  value.completeFunctions[i]();				
		  }
		}
		
        if(callback && effects == null) { callback(); }
      }
    },
    "jimEnable": function(args, callback) {
      if(jimUtil.exists(args) && jimUtil.exists(args.target)) {
        var self = this, $targets, $target, $icon;
        $targets = self.getEventTargets(args.target);
        if(jimUtil.exists($targets) && $targets.length) {
          for (var i = 0; i < $targets.length; ++i) {
            $target = jQuery($targets[i]);
            switch($target.jimGetType()) {
              case itemType.text:
              case itemType.password:
                $target.find("input").removeAttr("readonly");
                break;
              case itemType.file:
                $target.find(".icon").removeAttr("readonly").next("input[type='file']").removeAttr("disabled").removeClass("hidden");
                break;
              case itemType.textarea:
                  $target.find("textarea").removeAttr("readonly");
                  break;
              case itemType.date:
              case itemType.time:
              case itemType.datetime:
            	$target.find("input").removeAttr("readonly");
                $target.find(".icon").removeAttr("readonly");
                if(!jimDevice.isMobile() || (jimDevice.isMobile() && !jimDevice.isIOS())) {
           	     $target.find("input").each(function(){
           	    	 var $date = jQuery(this);
           	          $.datepicker._enableDatepicker($date[0]);
           	          $date.removeAttr("disabled");
           	     });
                }
                break;
              case itemType.radiobuttonlist:
              case itemType.checkboxlist:
                if(jimEvent.isInDataDataRow($target)) {
                  $target.find("tr.disabled").hide().end().find("tr.enabled").show().find("input").removeAttr("disabled");
                } else {
                  $target.removeAttr("readonly").find("input").removeAttr("disabled");
                }
                break;
              case itemType.checkbox:
              case itemType.radiobutton:
                $target.removeAttr("disabled");
                break;
              case itemType.dropdown:
              case itemType.nativedropdown:
                $target.removeAttr("readonly");
                $target.find("select").removeAttr("disabled");
                break;
              case itemType.selectionlist:
              case itemType.multiselectionlist:
                $target.removeAttr("readonly");
                if(jimEvent.isInDataDataRow($target)) {
                  $target.find("td.disabled").hide().prev("td.enabled").show();
                }
                break;
              default:
                $target.removeAttr("readonly");
                break;
            }
          }

          if(callback) { callback(); }
        }
      }
    },
    "jimDisable": function(args, callback) {
      if(jimUtil.exists(args) && jimUtil.exists(args.target)) {
        var self = this, $targets, $target, $icon;
        $targets = self.getEventTargets(args.target);
        if(jimUtil.exists($targets) && $targets.length) {
          for (var i = 0; i < $targets.length; ++i) {
            $target = jQuery($targets[i]);
            switch($target.jimGetType()) {
              case itemType.text:
              case itemType.password:
                $target.find("input").attr("readonly", "readonly");
                break;
              case itemType.file:
                $target.find(".icon").attr("readonly", "readonly").next("input[type='file']").attr("disabled", "disabled").removeClass("hidden").addClass("hidden");
                break;
              case itemType.textarea:
                  $target.find("textarea").attr("readonly", "readonly");
                  break;
              case itemType.date:
              case itemType.time:
              case itemType.datetime:
            	$target.find("input").attr("readonly", "readonly");
                $target.find(".icon").attr("readonly", "readonly");
                if(!jimDevice.isMobile() || (jimDevice.isMobile() && !jimDevice.isIOS())) {
              	     $target.find("input").each(function(){
              	    	 var $date = jQuery(this);
              	          $.datepicker._disableDatepicker($date[0]);
              	     });
                }
                break;
              case itemType.radiobuttonlist:
              case itemType.checkboxlist:
                if(jimEvent.isInDataDataRow($target)) {
                  $target.find("tr.disabled").show().end().find("tr.enabled").hide().find("input").attr("disabled", "disabled");
                } else {
                  $target.attr("readonly", "readonly").find("input").attr("disabled", "disabled");
                }
                break;
              case itemType.checkbox:
              case itemType.radiobutton:
                $target.attr("disabled", "disabled");
                break;
              case itemType.dropdown:
              case itemType.nativedropdown:
                $target.attr("readonly", "readonly");
                $target.find("select").attr("disabled", "disabled");
                break;
              case itemType.selectionlist:
              case itemType.multiselectionlist:
                $target.attr("readonly", "readonly");
                if(jimEvent.isInDataDataRow($target)) {
                  $target.find("td.disabled").show().prev("td.enabled").hide();
                }
                break;
              default:
                $target.attr("readonly", "readonly");
              break;
            }
          }

          if(callback) { callback(); }
        }
      }
    },
    "jimFocusOn": function(args, callback) {
    	 var self = this;
         if(args && args.target) {
           setTimeout( function () {
				jimUtil.jimFocusOn(self.getEventTarget(args.target[0]));
				if(callback) { callback(); }
		   }, 0);
         }
    },
    "jimScrollTo": function(args, callback) {
        var self = this, settings = {};
        if(args && args.target) {
          if(args.effect) {
        	jQuery.extend(settings, {"effect": jimUtil.createAnimationOptions(args.effect, callback)});
          }
          if(args.axis){
        	jQuery.extend(settings, {"scroll": args.axis});
          }
          jimUtil.jimPointTo(self.getEventTarget(args.target[0]), settings);
          if(callback && !args.effect) { callback(); }
        }
      },
    "jimSetValue": function(args, instance, callback) {
      if(jimUtil.exists(args)) {
        var self = this, $targets, $target, type, i, iLen, value, $options = [];
		var bShape =false;
        value = self.evaluateExpression(args.value, instance);
        if(jimUtil.exists(value)) {
          if(args.variable) {
        	 $targets = self.getEventTargets(args.variable);
             if($targets) {
                for(i=0, iLen = $targets.length; i < iLen; i += 1) {
                  var triggerVariableChange = jimData.get($targets[i]) != value;
                  jimData.set($targets[i], value);
                  if(triggerVariableChange)
                  	jQuery("html").trigger("variablechange", [{"variableTarget": $targets[i]}]);
                }
             }
          } else if(args.target) {
            $targets = self.getEventTargets(args.target);
            if($targets) {
              for(i=0, iLen = $targets.length; i < iLen; i += 1) {
                $target = jQuery($targets[i]);
                bShape=false;
                type = $target.jimGetType();
                switch(type) {
                  case itemType.shapewrapper:
                	bShape=true;
                  case itemType.richtext:
                  case itemType.textcell:
                  case itemType.rectangle:
                  case itemType.button:
                  case itemType.label:
                    $target.find(".valign span:first").html(jimUtil.toHTML(value));
                    $target.find(".valign span").slice(1).remove();
                    jimUtil.wrapLayout($target);
                    if($target.is(".percentage.autofit")) {
                    	jimResponsive.redoWidthValue($target);
                    }
					jimResponsive.refreshResponsiveComponents($target);
                    break;
                  case itemType.index:
                  case itemType.summary:
                    /* ignore */
                    break;
                  case itemType.image:
                    /* $target.attr("src", jimUtil.encodeURI(value)); */
                    try {
						
					  var $img = $target.find("img");
					  $img.css({
						"width" : "100%",
						"height" : "100%",
						"left" : "0px",
						"top" : "0px",
					  });
                      var data = $target.data();
                      if (value.indexOf('<svg')>=0 /*&& !value.endsWith("cross.svg")*/) {
                          var svg = JSON.parse(JSON.stringify(value));
                          args.data = data;
                          parseSVG(svg, $target, args);
                      } else {
                    	$target = $("#" + $target.attr('id'));
                        if ($target.find("svg").length) {
                     	  $target.append("<img>");
                		  $target.find("svg").remove();
                        }
                        value = value.replace("%", "%25");
                        value = value.replace("#", "%23");
                        $target.find("img").attr("src", value);
                        $target.data(data);
                      }
                    } catch (e) {}
                    break;
                  case itemType.date:
                  case itemType.time:
                  case itemType.datetime:
                    	if (jimUtil.isMobileDevice()) {
                      		var mobileDate = jimDate.convertToFormatMobile(value, $target);
                      		$target.find("input").val(jimUtil.fromHTML(mobileDate));
                      	}
                      	else {
    	                  	$target.find("input").val(jimUtil.fromHTML(value));
    	                  	$target.trigger("parsedate", []);
                        }
                    break;
                  case itemType.text:
                  case itemType.password:
                    $target.find("input").val(jimUtil.fromHTML(value));
                    break;
                  case itemType.file:
                    try {
                      $target.find("input").val(jimUtil.fromHTML(value));
                    } catch(error) {
                      switch(error.name) {
                        case "NS_ERROR_DOM_SECURITY_ERR":
                            /* silent ignore */
                          break;
                        default:
                          break;
                      }
                    }
                    break;
                  case itemType.textarea:
                    $target.find("textarea").val(jimUtil.fromHTML(value));
                    break;
                  case itemType.checkbox:
                  case itemType.radiobutton:
					if(value.toString() === "false") {
						$target.removeClass("unchecked");
						$target.removeClass("checked");
						$target.attr("checked", false);
						$target.addClass("unchecked");
					} else if (value.toString() === "true") {
						$target.removeClass("unchecked");
						$target.removeClass("checked");
						$target.attr("checked", true);
						$target.addClass("checked");
					}
                    break;
                  case itemType.dropdown:
                  case itemType.nativedropdown:
                    $target.children(".dropdown-options").html(jimEvent.getHtml(type, jimUtil.toArray(value)));
                    self.jimSetSelection({"target": $target, "value": $target.children(".dropdown-options").children(".option:first").text()});
                    if (jQuery(".jim-web-dd").is(":visible"))
                    	jQuery(".jim-web-dd").trigger("refreshDropDown", [$target]);
                    break;
                  case itemType.selectionlist:
                  case itemType.multiselectionlist:
                      $target.find("td").html(jimEvent.getHtml(type, jimUtil.toArray(value)));
                    break;
                  case itemType.radiobuttonlist:
                  case itemType.checkboxlist:
                      $target.find("tbody").html(jimEvent.getHtml(type, jimUtil.toArray(value), $target));
                    break;
                  case itemType.datalist:
                  case itemType.datagrid:
                    $target.dataview("update", value, self.event);
                    jimResponsive.refreshResponsiveComponents($target);
                    jimPin.pinAllElementsDescending($target);
                    jimUtil.wrapLayout($target);
                    break;
                  case itemType.url:
               		try {
               			// check if given value is a valid url, if not throws exception and value is not set.
	                  	var url = new URL(value);
	                  	$target.find("iframe").attr("src", value);
                  	} catch (error) {}                	
                  	break;
                  case itemType.html:
                  	// ensure is in text format and not in html (for instance, when it is label or shape value)
                  	if (/&\/?[a-z][\s\S]*&/i.test(value)) {
                  		var spanAux = document.createElement('span');
                  		spanAux.innerHTML = value;
                  		value = spanAux.innerText;
                  	}
                  	$target.find("iframe").attr("srcdoc", value);
                  	break;
                }
                 if(bShape){
					 shapeStyle = {};
					 shapeStyle.attributes = {};
					 jimShapes.updateStyle($target.find(".shape")[0],shapeStyle);
                 }
              }
            }
          }
        }
        if(callback) { callback(); }
      }
    },
    "jimSetSelection": function(args, instance, callback) {
      if(jimUtil.exists(args) && jimUtil.exists(args.value) && jimUtil.exists(args.target)) {
        var self = this, $targets, $target, type, value = "", $options, $option, option, t, tLen, o, oLen, v, vLen;
        if (args.value.datamaster) {
          jimData.set(args.target, jimGetDataInstanceIds(args.value.source));
        } else {
          value = self.evaluateExpression(args.value, instance);
          $targets = self.getEventTargets(args.target);
          if(jimUtil.exists($targets)) {
            for(t=0, tLen=$targets.length; t<tLen; t+=1) {
              $target = jQuery($targets[t]);
              type = $target.jimGetType();
              switch(type) {
                case itemType.dropdown:
                case itemType.nativedropdown:
                  $options = $target.children(".dropdown-options").children(".option").removeClass("selected");
                  for(o=0, oLen=$options.length; o<oLen; o+=1) {
                    option = $options[o];
                    if(option.textContent === value || option.innerText === value || (option.textContent != undefined && option.textContent.replace(/\s/g, '&nbsp;') === value.replace(/\s/g, '&nbsp;')) || (option.innerText != undefined && option.innerText.replace(/\s/g, '&nbsp;') === value.replace(/\s/g, '&nbsp;'))) {
                      jQuery(option).attr("selected","selected");
                      $target.find(".value").html(jimUtil.toHTML(value));
                      break;
                    }
                  }
                  break;
                case itemType.selectionlist:
                  $options = $target.find(".option").removeClass("selected");
                  for(o=0, oLen=$options.length; o<oLen; o+=1) {
                    $option = jQuery($options[o]);
                    if($option.text() === value || $option.text().replace(/\s/g, '&nbsp;') === value.replace(/\s/g, '&nbsp;')) {
                      $option.addClass("selected");
                      if(jimEvent.isInDataDataRow($target)) {
                        $target.find("td.disabled").html(jimUtil.toHTML(value));
                      }
                      break;
                    }
                  }
                  break;
                case itemType.multiselectionlist:
                  value = jimUtil.toArray(value);
                  $options = $target.find(".option").removeClass("selected");
                  for(o=0, oLen=$options.length; o<oLen; o+=1) {
                    $option = jQuery($options[o]);
                    for(v=0, vLen=value.length; v<vLen; v+=1) {
                      if($option.text() === value[v] || $option.text().replace(/\s/g, '&nbsp;') === value[v].replace(/\s/g, '&nbsp;')) {
                        $option.addClass("selected");
                        if(jimEvent.isInDataDataRow($target)) {
                            $target.find("td.disabled").html(jimUtil.toHTML(value));
                        }
                        break;
                      }
                    }
                  }
                  break;
                case itemType.radiobuttonlist:
                  var search = "div.radiobutton";
                  $options = $target.find(search).removeAttr("checked").end().find(".option");
				  $target.find(search).removeClass("unchecked checked");
			      $target.find(search).addClass("unchecked");
                  for(o=0, oLen=$options.length; o<oLen; o+=1) {
                    $option = jQuery($options[o]);
                    if($option.text() === value || $option.text().replace(/\s/g, '&nbsp;') === value.replace(/\s/g, '&nbsp;')) {
					  var $optionDiv = jQuery($option.prev(search)[0]);
					  $optionDiv.removeClass("unchecked");
					  $optionDiv.attr("checked", true);
                  	  $optionDiv.addClass("checked");
                      //disabled inside data grid
                      if(jimEvent.isInDataDataRow($target)) {
                        $target.find("tr.disabled td").html(jimUtil.toHTML(value));
                      }
                      break;
                    }
                  }
                  break;
                case itemType.checkboxlist:
                  value = jimUtil.toArray(value);
                  var search = "div.checkbox";
                  $options = $target.find(search).removeAttr("checked").end().find(".option");
				  $target.find(search).removeClass("unchecked checked");
			      $target.find(search).addClass("unchecked");
                  for(o=0, oLen=$options.length; o<oLen; o+=1) {
                    $option = jQuery($options[o]);
 					var $optionDiv = jQuery($option.prev(search)[0]);
                    for(v=0, vLen=value.length; v<vLen; v+=1) {
                      if($option.text() === value[v] || $option.text().replace(/\s/g, '&nbsp;') === value[v].replace(/\s/g, '&nbsp;')) {                	
					  $optionDiv.removeClass("unchecked");
			 		  $optionDiv.attr("checked", true);
					  $optionDiv.addClass("checked");
                    	//disabled inside data grid
                        if(jimEvent.isInDataDataRow($target)) {
                            $target.find("tr.disabled td").html(jimUtil.toHTML(value));
                        }
                        break;
                      }
                    }
                  }
                  break;
              }
            }
          }
        }
        if(callback) { callback(); }
      }
    },
    "jimPause": function(args, callback) {
      var self = this, $firer, undoPauseStack;
      if(jimUtil.exists(args)) {
        if(self.event.backupState) {
          $firer = self.getEventFirer();
          undoPauseStack = $firer.data("jimUndoPauseStack");
          if(!jimUtil.exists(undoPauseStack)) {
            undoPauseStack = [];
          }
          undoPauseStack.push(setTimeout(callback, args.pause));
          $firer.data("jimUndoPauseStack", undoPauseStack);
         } else {
          jimEvent.pauseStack.push(setTimeout(callback, args.pause));
         }
      }
    },
    "jimPlayAudio": function(args, callback) {
        var self = this;
        if(args.target) {
             for(t=0, tLen=args.target.length; t<tLen; t+=1) {
	               var targetAudio = "./audio/"+args.target[t];
	               var audio = document.createElement("audio");
	               audio.setAttribute("id",args.target[t]);
	               var source = document.createElement("source");
	               source.setAttribute("src",targetAudio);
	               audio.appendChild(source);

	               var simulation = document.getElementById("simulation");
	               simulation.appendChild(audio);
	               audio.addEventListener('ended', function(){
	            	   simulation.removeChild(audio);
	            	   if(callback) { callback(); }
	               });
	               audio.play();
             }
        }
      },
    "jimStopAudio": function(args, callback) {
	    var simulation = document.getElementById("simulation");
		if(args.target.length > 0){
			var audio = document.getElementById(args.target[0]);
			if(audio != null){
				audio.pause();
				simulation.removeChild(audio);
			}
		}
		else{
			$("audio").each(function () {
	             this.pause(); // Stop playing
                 simulation.removeChild(this);
	        });
		}
		if(callback) { callback(); }
      },
    "jimResize": function(args, callback) {
      if(jimUtil.exists(args)) {
        var self = this, $targets, $parent, type, i, iLen, width, height, bShape, shapeStyle, percentageWidth, percentageHeight, parentWidth, parentHeight;
        if(args.target) {
          $targets = self.getEventTargets(args.target, undefined, "jimResize");
          if($targets) {
        	// For each is needed for progress scoping on shapes
        	$targets.forEach(function(target, i) {
              var $target = jQuery(target);
              var vWrap = $target.closest(".layout.wrap");
              if ($target.is(".table, .datagrid, .datalist, .panel")) vWrap = $target.find("."+$target.attr('id').replace(/\br[0-9]*_/,"").substring(2)+".wrap");
              else if ($target.is(".cellcontainer") || $target.is(".gridcell") || $target.is(".datacell")) {
            	var parent = $target.closest(".table, .datagrid, .datalist");
            	vWrap = parent.find("."+parent.attr('id').replace(/\br[0-9]*_/,"").substring(2)+".wrap");
              }

              bShape=false;
              if($target.jimGetType() === itemType.panel)
                $parent = $target.closest(".dynamicpanel").parent();
              else if($target.is(".cellcontainer") || $target.is(".datacell") || $target.is(".textcell") )
                $parent = $target.closest(".table, .datalist");
              else
                $parent = $target.parent();

              if($target.jimGetType() === itemType.shapewrapper) {
                bShape=true;
              }

              if($parent.closest(".firer").is(".screen, .template"))
                $parent = $parent.closest(".ui-page");

              if(args.width && args.width.type!=="noresize") {
                width = self.evaluateExpression(args.width.value);
                if(args.width.type==="percentage" && jimUtil.exists($parent)) {
                  percentageWidth = width;
                  parentWidth = jimUtil.getScrollContainerSize($parent).width;
                  if($target.is(".shape") && jimUtil.exists(percentageWidth) && !isNaN(parseInt(percentageWidth, 10)))
                    width = parentWidth / 100 * percentageWidth;
                }

                if(jimUtil.exists(width) && !isNaN(parseInt(width, 10))) {
                  var substraction = jimEvent.fn.getCurrentStyle('border-left-width', $target) + jimEvent.fn.getCurrentStyle('border-right-width', $target);
                  if ($target.is(".table") || $target.is(".datalist") || $target.is(".datagrid") || ((args.width.type==="percentage") && !$target.is(".shape"))) substraction = 0;

                  width = Math.max(width - substraction, 0);
                  jimResponsive.setNewWidth($target, (args.width.type==="percentage") ? percentageWidth : width, (args.width.type==="percentage") ? "%" : "px");
                }

                if($target.hasClass("lockH") && args.width.type!=="noresize"){
                  $target.removeClass("lockH");
                }

              }
              if(args.height && args.height.type!=="noresize") {
                height = self.evaluateExpression(args.height.value);
                if(args.height.type==="percentage" && jimUtil.exists($parent)) {
                  percentageHeight = height;
                  parentHeight = jimUtil.getScrollContainerSize($parent).height;
                  if($target.is(".shape") && jimUtil.exists(percentageHeight) && !isNaN(parseInt(percentageHeight, 10)))
                    height = parentHeight / 100 * percentageHeight;
                }

                if(jimUtil.exists(height) && !isNaN(parseInt(height, 10))) {
                  var substraction = jimEvent.fn.getCurrentStyle('border-top-width', $target) + jimEvent.fn.getCurrentStyle('border-bottom-width', $target);

                  if ($target.hasClass("textcell") || $target.hasClass("cellcontainer") || $target.hasClass("datacell") || $target.hasClass("gridcell"))
                    substraction += jimEvent.fn.getCurrentStyle('border-top-width', $target) + jimEvent.fn.getCurrentStyle('border-bottom-width', $target);

                  if ($target.is(".table") || $target.is(".datalist") || $target.is(".datagrid") || ((args.height.type==="percentage") && !$target.is(".shape")))  substraction = 0;

                  height = Math.max(height - substraction, 0);
                  jimResponsive.setNewHeight($target, (args.height.type==="percentage") ? percentageHeight : height, (args.height.type==="percentage") ? "%" : "px");
                }

                if($target.hasClass("lockV") && args.height.type!=="noresize"){
                  $target.removeClass("lockV");
                }
              }


              if(percentageWidth || percentageHeight) {
              	$target.removeClass("percentage").addClass("percentage");
				
				if (!percentageHeight  && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
					$target.parent().css("height", "");
				if (!percentageWidth && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
					$target.parent().css("width", "");				
              }
              else {
            	  $target.removeClass("percentage");
                  if (args.height && args.height.type!=="noresize" && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
                	  $target.parent().css("height", "");
                  if (args.width && args.width.type!=="noresize" && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
                  	  $target.parent().css("width", "");
              }
              $target.removeAttr("datasizewidth");
              $target.removeAttr("datasizeheight");

              var effect;
              if(args.effect){
                effect = jimUtil.createResizeAnimationOptions(args.effect, vWrap);
                var responsiveProgress = function(){
              	  jimResponsive.refreshResponsiveComponents($target, undefined, undefined, false);
				  //refresh items size in layouts
				  jimUtil.refreshEventResponsiveLayoutItem($target);
                }
                var progress = function(){
              	  if(responsiveProgress!==undefined)
              		  responsiveProgress();
              	  if (!bShape)
              	  	jimUtil.adaptItemToNewSize($target);
                };
                var complete = function() {
                  jimResponsive.refreshResponsiveComponents($target, undefined, undefined, true);
                  if (!bShape)
                  	jimUtil.adaptItemToNewSize($target);
              	};
                jQuery.extend(effect,{"progress": progress});
                jQuery.extend(effect,{"complete": complete});
              }

              if($target.is(".table") || $target.is(".datalist") || $target.is(".datagrid")) {
                jimUtil.resizeTable($target, width, height, effect, callback);
                jimUtil.adaptItemToNewSize($target);
              }
              else if($target.is(".cellcontainer") || $target.is(".datacell") || $target.is(".textcell")) {
                jimUtil.resizeCell($target, width, height, effect, true, callback);
              }
              else if($target.is(".headerrow") || $target.is(".datarow")) {
                jimUtil.resizeRow($target, width, height, effect, callback);
              }
              else if($target.is(".gridcell")) {
              	var $dataGrid = $target.closest(".datagrid");
               	if(jimUtil.exists(width) && !isNaN(parseInt(width, 10)))
                  $dataGrid.attr("childwidth", width);
                if(jimUtil.exists(height) && !isNaN(parseInt(height, 10)))
                  $dataGrid.attr("childheight",height);
                  $dataGrid.dataview("updateDataGridBounds");
              }
			  else {
                if(args.width && args.width.type==="percentage" && jimUtil.exists($parent)) {
                  width = width + "%";
                }
                if(args.height && args.height.type==="percentage" && jimUtil.exists($parent)) {
                  height = height + "%";
                }

                effect = jimUtil.createResizeAnimationOptions(args.effect, vWrap, callback);
                var properties = {};

                if((jimUtil.exists(width) && !isNaN(parseInt(width, 10))) || (jimUtil.exists(height)  && !isNaN(parseInt(height, 10)))){
                  jimUtil.convertToManualFitText($target);
                }

                if(jimUtil.exists(width) && !isNaN(parseInt(width, 10))){
                  jQuery.extend(properties, {"width": width});
                }
                if(jimUtil.exists(height)  && !isNaN(parseInt(height, 10))){
                  if($target.hasClass("manualfit"))
                    jQuery.extend(properties, {"min-height": height});
                  else
                    jQuery.extend(properties, {"height": height});
                }

                if(args.effect) {
                  if(bShape) {
                    var shapeProgress = function() {
                      var $shapewrapper = $(target);
                      shapeStyle = {};
                      shapeStyle.attributes = {"width":$shapewrapper.css("width"), "height":$shapewrapper.css("height"),"min-height":$shapewrapper.css("min-height")};
                      jimShapes.updateStyle($shapewrapper.find(".shape")[0],shapeStyle);
                    }
                  }

                  var progress2 = function(){
                	  if(shapeProgress!==undefined)
                		  shapeProgress();
                	  progress();
                  };

                  var complete2 = function() {
                	  progress2();
                	  complete();
                  }

                  jQuery.extend(effect,{"progress": progress2});
                  jQuery.extend(effect,{"complete": complete2});

                  var $layoutContainer = jimUtil.getLayoutContainer($target);
		              if ($layoutContainer && $layoutContainer.length > 0) {
		              	var layoutWrapperStepFunction =  function(now, e) {
		              		if ($(e.elem.target).is(".relativeLayoutWrapper") && e.elem.properties) {
		              			var newX = interpolateValue(e.elem.properties.startLeft, e.elem.properties.endLeft, now/100);
		              			var newY = interpolateValue(e.elem.properties.startTop, e.elem.properties.endTop, now/100);
		              			$(e.elem.target).css({'transform': 'translate(' + newX + 'px, ' + newY + 'px)'});
		              		}
			              };
			              jQuery.extend(effect,{"step": layoutWrapperStepFunction});
		              	var childrenToAnimate = jimUtil.updateLayoutChildrenPositions($layoutContainer, true, {"target": $target, "properties": properties});
		              	childrenToAnimate.push({"target": $target, "properties": properties});
		              	$(function () {
		              		for (var i = 0; i < childrenToAnimate.length; i++) {
		              			if (!$(childrenToAnimate[i].target).is(".relativeLayoutWrapper"))
		              				$(childrenToAnimate[i].target).animate(childrenToAnimate[i].properties, effect);
		              			else {
		              				// If relativeLayoutWrapper, it has to be translated
		              				// transform: translate() can not be animated using the regular animate method. Use custom one:
		              				var e = {foo:0};
		              				e.target = childrenToAnimate[i].target;
		              				e.properties = childrenToAnimate[i].properties;
		              				$(e).animate({foo:100}, effect);
		              			}
		              		}
										});
		              } else {
									  if ((percentageWidth || percentageHeight) && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
											$target.parent().animate(properties, effect);
									  else 
					             $target.animate(properties, effect);
				           }
                } else {
                
                  if ((percentageWidth || percentageHeight) && $target.hasClass("panel") && $target.parent().hasClass("dynamicpanel"))
                  	$target.parent().css(properties);
                  else
                    $target.css(properties);

                  if(bShape) {
                    shapeStyle = {};
                    shapeStyle.attributes = {"width":width, "height":height,"min-height":height};
                    jimShapes.updateStyle($target.find(".shape")[0],shapeStyle);
                  } else jimUtil.adaptItemToNewSize($target);
                }
              }

              jimUtil.forceReflow();
			  jimUtil.refreshEventResponsiveLayoutItem($target);
              jimUtil.refreshPageMinSizeWithTarget($target);

              if(!args.effect || $target.is(".gridcell")) jQuery.each(vWrap, function (index, value) {jimUtil.wrapLayout(value);});

              if(!args.effect){
                  jimResponsive.refreshResponsiveComponents($target);
              }

              var $layoutContainer = jimUtil.getLayoutContainer($target);
	            if ($layoutContainer && $layoutContainer.length > 0 && !args.effect) {
	              	jimUtil.updateLayoutChildrenPositions($layoutContainer, false);
	            }
            });

            jQuery(window).trigger("reloadScrollBars");
          }
        }

        if(callback && !args.effect) { callback(); }
      }
    },
	"jimRotate": function(args, callback) {
	      if(jimUtil.exists(args)) {
	        var self = this, $targets, $target, type, i, iLen, angle,  bShape, shapeStyle;
	        if(args.target) {
	          $targets = self.getEventTargets(args.target,undefined,"jimRotate");
	          if($targets) {
	            for(i=0, iLen = $targets.length; i < iLen; i += 1) {
	              $target = jQuery($targets[i]);
				  $target.jimForceVisibility();
	              bShape=false;

	              if($target.jimGetType() === itemType.shapewrapper) {
	                bShape=true;
	              }

				  var isRelative = $target.is(".masterinstance, .group");
	              var currentAngle = parseFloat(jimUtil.getRotationDegrees($target));
	              if(args.angle) {
	                angle = self.evaluateExpression(args.angle.value);
	                if(args.angle.type==="rotateby" && !isRelative)
	                	angle= parseFloat(angle) + currentAngle;
					else if (isRelative && args.angle.type!="rotateby")
						angle = parseFloat(angle) - currentAngle;
	              }

	              var effect;
	              if(args.effect)
	                effect = jimUtil.createAnimationOptions(args.effect, callback);

				  var translate = jimUtil.getTransformTranslate($target);
				  if (translate == undefined)
					  translate = {x:0, y:0};

	              var target = $target[0];
	              if(target.rotationdeg=== undefined)
	            	  target["rotationdeg"] = currentAngle;

   				  $target.jimUndoVisibility();
	              if(args.effect) {
	            	var properties = {};
		            if(jimUtil.exists(angle) && !isNaN(parseFloat(angle, 10)))
		               jQuery.extend(properties, {rotationdeg: (isRelative ? currentAngle : 0)+ parseFloat(angle)});

					var bounds = jimUtil.getRelativeItemBounds($target);
					var lastAngle = currentAngle;

	              	var stepFunction =  function(now, x) {
	              		// in the step-callback (that is fired each step of the animation),
                        // you can use the `now` paramter which contains the current
                        // animation-position (`0` up to `angle`)
						if (isRelative) {
							if (now != 0) {
								jimUtil.rotateRelativeItemChilds($target, now - lastAngle, {x : bounds.x + bounds.width / 2, y : bounds.y + bounds.height / 2}, now - lastAngle + target["rotationdeg"]);
								target["rotationdeg"] = parseFloat(now - lastAngle) + parseFloat(currentAngle);
								lastAngle += now - lastAngle;
							}
						} else {
							var item = $(x.elem);
							item.css({
								transform: 'translate(' + translate.x + 'px, ' + translate.y + 'px) rotate(' + now + 'deg)'
							});
							if(bShape) {
								shapeStyle = {};
								shapeStyle.attributes = {"-webkit-transform":now};
								jimShapes.updateStyle(item.find(".shape")[0],shapeStyle);
							}
						}
                    };
	                jQuery.extend(effect, {"step": stepFunction});
					jQuery.extend(effect, {"complete" : function () {
						if (angle != 0) {
						  var finalAngle = parseFloat(angle) + parseFloat(currentAngle);
						  if (isRelative)
						  	jimUtil.rotateRelativeItemChilds($target, finalAngle - target["rotationdeg"], {x : bounds.x + bounds.width / 2, y : bounds.y + bounds.height / 2}, finalAngle);
						  target["rotationdeg"] = (parseFloat(angle) + parseFloat(currentAngle)) % 360;
						}
						if (callback)
						  callback();
					}});
					
	                $target.animate(properties, effect);

	              } else {
					if (isRelative) {
						var bounds = jimUtil.getRelativeItemBounds($target);
						if (angle != 0) {
						  jimUtil.rotateRelativeItemChilds($target, angle, {x : bounds.x + bounds.width / 2, y : bounds.y + bounds.height / 2}, parseFloat(angle) + parseFloat(currentAngle));
						  target["rotationdeg"] = (parseFloat(angle) + parseFloat(currentAngle)) % 360;
						}
					} else {
						$target.css({
							transform: 'translate(' + translate.x + 'px, ' + translate.y + 'px) rotate(' + angle + 'deg)'
						});
						target["rotationdeg"] = angle;
					}
	                
	                if(bShape) {
	                    shapeStyle = {};
	                    shapeStyle.attributes = {"-webkit-transform":angle};
	                    jimShapes.updateStyle($target.find(".shape")[0],shapeStyle);
	                 }
	             }

	            jimUtil.forceReflow();
				jimUtil.refreshEventResponsiveLayoutItem($target);
	            jimUtil.refreshPageMinSizeWithTarget($target);
	            }
	          }
	        }

	        if(callback && !args.effect) { callback(); }
	      }
	    },
	 "jimChangeCursor": function(args, callback) {
        if(args.type) {
        	if(jimDevice.isMobile() || jimUtil.isMobileDevice()) {}
        	else {
        		$("#simulation").css({ 
        			cursor: args.type
        		});
        	}
        	if(callback) { callback(); }
        }
      }
  });

})(window);
