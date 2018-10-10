var selectablesModel=window.location.href.indexOf("checking")!==-1?["selectOfOrderNameSelectWithSearch","existOrdersSearchHints","orderedTableBody","orderOffersTableBody"]:["selectOfOrderNameSelectWithSearch","searchHints","orderFormsTableBody","orderOffersTableBody"]


var currentSelectable
var selectedOption
var selectedOptions = {}

function setSelectable(selectable)
{
	var newVal = selectable
	if (typeof (newVal) === "string")
		if (document.getElementById(newVal))
		{
			if(document.getElementById(newVal))
				document.getElementById(newVal).style.display=""
			if (document.getElementsByClassName(selFEd + currentSelectable)[0])
				if (currentSelectable.indexOf("orderOffersTableFields") !== 0)
					document.getElementsByClassName(selFEd + currentSelectable)[0].style.opacity = 0.3
			currentSelectable = newVal
			setOption(selectedOptions[currentSelectable] ? selectedOptions[currentSelectable] : 0)

			if (document.getElementsByClassName(selFEd + currentSelectable)[0])
			{
				document.getElementsByClassName(selFEd + currentSelectable)[0].style.opacity = 1

				if (document.getElementsByClassName(selFEd + currentSelectable)[0] !== document.activeElement)
				{
					document.getElementsByClassName(selFEd + currentSelectable)[0].style.display = ''
					aFocus = true
					document.getElementsByClassName(selFEd + currentSelectable)[0].focus()
				}
			}
		}
}

function validOption(option)
{
	var newVal
	if (document.getElementById(currentSelectable))
	{
		var selectables = document.getElementById(currentSelectable).children.length
		newVal = (Number.parseInt(option) % selectables + selectables) % selectables
	}
	else newVal = Number.parseInt(option)
	if (typeof (newVal) === "number")
		if (!Number.isNaN(newVal))
			if (Number.isFinite(newVal))
				return newVal
	return undefined
}

function setOption(option)
{
	option = validOption(option)
	if (option !== undefined)
	{
		if(document.getElementById(currentSelectable))
			document.getElementById(currentSelectable).style.display=""
		if (getOptionElement(selectedOption))
			getOptionElement(selectedOption).style['background-color'] = ''

		selectedOption = option
		selectedOptions[currentSelectable] = option

		document.getElementById(currentSelectable).selectedIndex = option
		document.getElementById(currentSelectable).selectedIndex = -1

		if (getOptionElement(selectedOption))
			getOptionElement(selectedOption).style['background-color'] = 'orange'
	}
}

function getOptionElement(option)
{
	option = validOption(option)
	if (option !== undefined)
		return document.getElementsByClassName("selectable-" + currentSelectable + "-" + option)[0]
}

function getOptionText(option)
{
	option = validOption(option)
	if (option !== undefined)
		if (document.getElementsByClassName("textOfSelectable-" + currentSelectable + "-" + option)[0])
			return document.getElementsByClassName("textOfSelectable-" + currentSelectable + "-" + option)[0].textContent
}

var allONVars="allVarsOfOrderNameSelectWithSearch"

function refillOrderNames(func)
{
	sendRequest("get", "/getordersnames", "", function(text)
	{
		document.getElementById(allONVars).innerHTML = ""
		var ordersNames = JSON.parse(text)
		for (var v = 0; v < ordersNames.length; v++)
			document.getElementById(allONVars).innerHTML += "<option>" + ordersNames[v] + "</option>"
		document.getElementById(allONVars).innerHTML += "<option class='createNewOrder'>"
				+ getMsg("createNewOrder") + "</option>"
		if(func)
			func()
	})
}
function toDateLook(str)
{
	str=str+""
	return str.length===0?"00":str.length===1?"0"+str:str
}

function createNewOrder()
{
	var date=new Date()
	var def
	for(var orderNum=1;!def;orderNum++)
	{
		def="Заказ №"+orderNum+" от "+toDateLook(date.getDay())+"."+toDateLook(date.getMonth()+1)+"."+date.getFullYear()+" "+toDateLook(date.getHours())+":"+toDateLook(date.getMinutes())
		for(var v=0;v<document.getElementById(allONVars).children.length;v++)
			if(document.getElementById(allONVars).children[v].textContent.indexOf("Заказ №"+orderNum)===0)
				def=undefined
	}
	var name = prompt(getMsg("enterOrderName"),def)
	var exists=false
	for(var v=0;v<document.getElementById(allONVars).children.length;v++)
		if(document.getElementById(allONVars).children[v].textContent===name)
			exists=true
	if(name&&name!=""&&!exists)
	sendRequest("post", "/createorder", "orderName=" + name, function(text)
	{
		refillOrderNames(function()
		{
			for(var v=0;v<document.getElementById(currentSelectable).children.length;v++)
				if(getOptionText(v)===name)
					{
					setOption(v)
					break
					}
		})
	})
}

refillOrderNames()




var selFE="focusElementOfSelectable", selFEd=selFE+"-"
	



var values = []

var values2 = []

document
		.addEventListener(
				"keydown",
				function(e)
				{
					var preventDefault = true
					switch (e.keyCode)
					{
						case 38: // Arrow up
							console.log(selectedOption)
							setOption(selectedOption - 1)
							console.log(selectedOption)
							break

						case 40: // Arrow down
							console.log(selectedOption)
							setOption(selectedOption + 1)
							console.log(selectedOption)
							break

						case 13: // Enter
							if (currentSelectable==="searchHints")
								find(document.getElementById("searchField").value)
							else preventDefault = false
							break

						case 27: // Escape
							var b1=false
							for(var v=1;v<selectablesModel.length;v++)
								if(currentSelectable===selectablesModel[v])
								{
									document
											.getElementsByClassName(selFEd + currentSelectable)[0].style.display = "none"
									setSelectable(selectablesModel[v-1])
									b1=true
								}
							if(!b1)
								if (currentSelectable.indexOf("orderOffersTableField") !== -1)
									setSelectable("orderOffersTableBody")
								else preventDefault = false
							if(preventDefault)
								if(document.getElementById(currentSelectable+"Label"))
									document.getElementById(currentSelectable+"Label").style.display = "none"
							break

						case 9: // Tab
							if (currentSelectable === "orderOffersTableBody")
								setSelectable("orderOffersTableFields" + selectedOption)
							else find(getOptionText(selectedOption))
							break

						default:
							preventDefault = false
							break
					}
					if (preventDefault)
						e.preventDefault()
				},true)
var aFocus;
document.addEventListener("focus", function(e)
{
	if(aFocus)
		{
		aFocus=false
		return
		}
	for (var v0 = 0; v0 < e.path.length; v0++)
	{
		if (!e.path[v0].getAttribute ? true : !e.path[v0].getAttribute("class"))
			continue

		var already = false;
		var classes = e.path[v0].getAttribute("class").split(" ")
		for (var v = 0; v < classes.length; v++)
		{
			var elements = classes[v].split("-")
			if (elements[0] !== selFE)
				continue

			var ind = 0
			var ind2 = 0

			if (currentSelectable)
			{
				for(var v=0;v<selectablesModel.length;v++)
					if(currentSelectable===selectablesModel[v])
						ind=v+1
				if (currentSelectable.indexOf("orderOffersTableFields") === 0)
					ind = selectablesModel.length+1
					
				for(var v=0;v<selectablesModel.length;v++)
					if(elements[1]===selectablesModel[v])
						ind2=v+1
				if (elements[1].indexOf("orderOffersTableFields") === 0)
					ind2 = selectablesModel.length+1
			}
			setSelectable(elements[1])
			
			for(var v=1;v<selectablesModel.length;v++)
				if(ind2<v+1)
					document.getElementsByClassName(selFEd + selectablesModel[v])[0].style.display = "none"

			already = true
		}
		if (already)
		{
			if (lastE)
				mouseOnListener(lastE)
			break
		}
	}
}, true)

var mouseOnListener = function(e)
{
	for (var v0 = 0; v0 < e.path.length; v0++)
		if (e.path[v0].getAttribute)
			if (e.path[v0].getAttribute("class"))
			{
				var classes = e.path[v0].getAttribute("class").split(" ")
				for (var v = 0; v < classes.length; v++)
				{
					var elements = classes[v].split("-")
					if (elements[0] === "selectable")
						if (elements[1] === currentSelectable)
							setOption(elements[2])
				}
			}
}

var lastE

document.addEventListener("mouseover", mouseOnListener)
document.addEventListener("mousemove", mouseOnListener)
document.addEventListener("mouseup", mouseOnListener)
document.addEventListener("mousedown", mouseOnListener)

document.addEventListener("mousedown", function(e)
{
	for (var v0 = 0; v0 < e.path.length; v0++)
		if (e.path[v0].getAttribute)
			if (e.path[v0].getAttribute("class"))
			{
				var classes = e.path[v0].getAttribute("class").split(" ")
				for (var v = 0; v < classes.length; v++)
				{
					var elements = classes[v].split("-")
					if (elements[0] === "selectable")
						if (elements[1] === currentSelectable)
						{
							if (currentSelectable === "orderOffersTableBody")
								setSelectable("orderOffersTableFields" + selectedOption)
							else find(getOptionText(selectedOption))
							return undefined
						}
				}
			}
	lastE = e
})

var timerMoments={};
function update(vars)
{
	values = []
	for (var v = 0; v < vars.length; v++)
		if (vars[v].replace(/[ \t\r\f\n]+/g, "") != "")
			values.push(vars[v])
	var searchHints = document.getElementById("searchHints")
	var content = ""
	for (var v = 0; v < values.length; v++)
		content += "<option style='list-styletype=none; ' class='selectable-" + searchHints.id + "-" + v
				+ " textOfSelectable-" + searchHints.id + "-" + v + "'>"
				+ values[v] + "</option>"
	searchHints.innerHTML = content
	if (values.length != 0)
		setOption(0)
	updateSearch("searchHints","searchField")
}
function updateSearch(selectName, fieldName)
{
	var select = document.getElementById(selectName)
	var field = document.getElementById(fieldName)
	select.style.display = select.children.length != 0 ? '' : "none"
	select.style.top = field.getBoundingClientRect().bottom+"px"
	select.style.left = field.getBoundingClientRect().left+"px"
	select.style.right = field.getBoundingClientRect().right+"px"
	select.style.width = getComputedStyle(field).width
}

function func(selectName, fieldName)
{
	var select = document.getElementById(selectName)
	var field = document.getElementById(fieldName)
	switch(selectName)
	{
		case "searchHints":
			var hasResponse = false;
			var onFunc = function(text)
			{
				update(text.split("&"));
				hasResponse = true;
			}
			sendRequest("get", "/getdata", "hintSearch=" + field.value + "&", onFunc);
			timerMoments[selectName] = new Date().getTime();
			setTimeout(function()
			{
				if (timerMoments[selectName] + 500 == new Date().getTime())
					if (!hasResponse)
						update([]);
			}, 1000);
			setTimeout(function()
			{
				if (!hasResponse)
					select.style.display = 'none';
			}, 100);
			break
		case "selectOfOrderNameSelectWithSearch":
			var allOrderNameField = document.getElementById(allONVars)
			var vars=[]
			for(var v=0;v<allOrderNameField.children.length;v++)
				if(allOrderNameField.children[v].textContent.toLowerCase().indexOf(searchOfOrderNameSelectWithSearch.value.toLowerCase())!==-1)
					vars.push(allOrderNameField.children[v])
					
			values2 = [];
			for (var v = 0; v < vars.length; v++)
				values2.push(vars[v]);
			var selectOfOrderNameSelectWithSearch = document.getElementById("selectOfOrderNameSelectWithSearch");
			selectOfOrderNameSelectWithSearch.innerHTML=""
			for (var v = 0; v < values2.length; v++)
			{
				var node=values2[v].cloneNode(true)
				selectOfOrderNameSelectWithSearch.appendChild(node)
				node.setAttribute("class",node.getAttribute("class")+" "+"textOfSelectable-selectOfOrderNameSelectWithSearch-"+v+" selectable-selectOfOrderNameSelectWithSearch-"+v)
			}
			if (values2.length != 0)
				setOption(0);
			updateSearch(selectName,fieldName)
			break
		case "existOrdersSearchHints":
			var hasResponse = false;
			var onFunc = function(text)
			{
				console.log(text)
				var vars=JSON.parse(text)
				values3 = []
				for (var v = 0; v < vars.length; v++)
					if (vars[v].replace(/[ \t\r\f\n]+/g, "") != "")
						values3.push(vars[v])
				var searchHints = document.getElementById("existOrdersSearchHints")
				var content = ""
				for (var v = 0; v < values3.length; v++)
					content += "<option style='list-styletype=none; ' class='selectable-" + searchHints.id + "-" + v
							+ " textOfSelectable-" + searchHints.id + "-" + v + "'>"
							+ values3[v] + "</option>"
				searchHints.innerHTML = content
				if (values3.length != 0)
					setOption(0)
				updateSearch("existOrdersSearchHints","existOrdersSearchField")
				hasResponse = true;
			}
			sendRequest("get", "/getdata", "existOrdersSearch=" + field.value + "&", onFunc);
			timerMoments[selectName] = new Date().getTime();
			setTimeout(function()
			{
				if (timerMoments[selectName] + 500 == new Date().getTime())
					if (!hasResponse)
						update([]);
			}, 1000);
			setTimeout(function()
			{
				if (!hasResponse)
					select.style.display = 'none';
			}, 100);
			break
	}
}

var orderFormsTableStructure, orderedTableStructure, orderOffersTableStructure, archiveTableStructure

function loadTableStructure(name)
{
	sendRequest("get", "/getdata", "nameOfTableStructure="+name, function(text2)
	{
		try
		{
			switch(name)
			{
				case "orderForms":
					orderFormsTableStructure = JSON.parse(text2)
					break
				case "ordered":
					orderedTableStructure = JSON.parse(text2)
					break
				case "orderOffers":
					orderOffersTableStructure = JSON.parse(text2)
					break
				case "archive":
					archiveTableStructure = JSON.parse(text2)
					break
			}
		}
		catch(e)
		{
			console.warn(e)
			loadTableStructure(name)
		}
	})
}
loadTableStructure("orderForms")
loadTableStructure("ordered")
loadTableStructure("orderOffers")
loadTableStructure("archive")

function find(req)
{
	if(document.getElementById(currentSelectable+"Label"))
	{
		document.getElementById(currentSelectable+"Label").style.display=""
		document.getElementById(currentSelectable+"Label").textContent=getOptionText(selectedOption)
	}
	switch (currentSelectable)
	{
		case "selectOfOrderNameSelectWithSearch":
			document.getElementById(currentSelectable).style.display = 'none'
			if(getOptionElement(selectedOption).getAttribute("class").indexOf("createNewOrder")!==-1)
				createNewOrder()
			else
			{
				currentOrderName=getOptionText(selectedOption)
				setSelectable(selectablesModel[1])
			}
			break
			
		case "searchHints":
			var onFunc = function(text)
			{
				var head = document.getElementById("orderFormsTableHead");
				var table = document.getElementById("orderFormsTableBody");
				var rows = [];
				for (var v = 0; v < text.split("&").length; v++)
					if (text.split("&")[v] != "")
					{
						if (!rows[text.split("&")[v].split("=")[0].split("_")[0]])
							rows[text.split("&")[v].split("=")[0].split("_")[0]] = {};
						rows[text.split("&")[v].split("=")[0].split("_")[0]][text.split("&")[v].split("=")[0]
								.split("_")[1]] = text.split("&")[v].split("=")[1];
					}
				fillTable("orderFormsTable", rows);
				document.getElementById(currentSelectable).style.display = 'none'
				setSelectable(selectablesModel[2])
			}
			sendRequest("get", "/getdata", "orderFormSearch=" + req + "&", onFunc);
			break
		case "existOrdersSearchHints":
			setSelectable(selectablesModel[2])
			break

		case "orderFormsTableBody":
			var onFunc = function(text)
			{
				var head = document.getElementById("orderOffersTableHead");
				var table = document.getElementById("orderOffersTableBody");
				var rows = [];
				for (var v = 0; v < text.split("&").length; v++)
					if (text.split("&")[v] != "")
					{
						if (!rows[text.split("&")[v].split("=")[0].split("_")[0]])
							rows[text.split("&")[v].split("=")[0].split("_")[0]] = {};
						rows[text.split("&")[v].split("=")[0].split("_")[0]][text.split("&")[v].split("=")[0]
								.split("_")[1]] = text.split("&")[v].split("=")[1];
					}

				var onFunc2 = function(text2)
				{
					var orders = [];
					for (var v = 0; v < text2.split("&").length; v++)
						if (text2.split("&")[v] != "")
						{
							if (!orders[text2.split("&")[v].split("=")[0].split("_")[0]])
								orders[text2.split("&")[v].split("=")[0].split("_")[0]] = {};
							orders[text2.split("&")[v].split("=")[0].split("_")[0]][text2.split("&")[v]
									.split("=")[0].split("_")[1]] = text2.split("&")[v].split("=")[1];
						}
					for (var v = 0; v < rows.length; v++)
						if (rows[v])
						{
							rows[v]["obliqueness"] = (rows[v]["price"] / rows[0]["price"] * 100 - 100) + "%"
							for (var v2 = 0; v2 < orders.length; v2++)
								if (orders[v2])
									if (rows[v].naming == orders[v2].naming)
										if (rows[v].distributor == orders[v2].distributor)
											if (rows[v].manufacturer == orders[v2].manufacturer)
											{
												rows[v].id = v2
												for ( var key in orders[v2])
													if (!rows[v][key])
														rows[v][key] = orders[v2][key]
											}
						}
					fillTable("orderOffersTable", rows);
					var func = function(v)
					{
						var editor = document.getElementsByClassName(table.id + "-" + v + "-" + "order" + "-"
								+ "editor")[0]
						if(!editor)
							return
						var inStock = document.getElementsByClassName(table.id + "-" + v + "-" + "inStock")[0]
						var price = document.getElementsByClassName(table.id + "-" + v + "-" + "price")[0]
						var naming = document.getElementsByClassName(table.id + "-" + v + "-" + "naming")[0]
						var distributor = document.getElementsByClassName(table.id + "-" + v + "-"
								+ "distributor")[0]
						var manufacturer = document.getElementsByClassName(table.id + "-" + v + "-"
								+ "manufacturer")[0]
						var id = document.getElementsByClassName(table.id + "-" + v + "-" + "id")[0]
						var cost = document.getElementsByClassName(table.id + "-" + v + "-" + "cost")[0]
						var recalcCost = function()
						{
							cost.textContent = Number.parseFloat(price.textContent)
									* Number.parseInt(editor.value)
						}
						editor.oninput = function()
						{
							if (Number.parseInt(editor.value) > Number.parseInt(inStock.textContent))
							{
								var enter = prompt("$msg.error_orderGreaterThanInStock$".replace(/%0/g,
										editor.value).replace(/%1/g, inStock.textContent), inStock.textContent)
								if (enter)
									editor.value = enter
								else editor.value = editor.lastValue
								return this.oninput()
							}
							if (Number.parseInt(editor.value) < 0)
							{
								var enter = prompt(
										"$msg.error_orderLessThanZero$".replace(/%0/g, editor.value), Math
												.abs(Number.parseInt(editor.value)))
								if (enter)
									editor.value = enter
								else editor.value = editor.lastValue
								return this.oninput()
							}
							setTimeout(function()
							{
								editor.focus()
							}, 100)
							editor.lastValue = editor.value
							var onOk = function()
							{
								recalcCost()
								var orderData = ""
								orderData += id.textContent + "_order=" + editor.value + ";"
								orderData += id.textContent + "_distributor=" + distributor.textContent + ";"
								orderData += id.textContent + "_manufacturer=" + manufacturer.textContent + ";"
								orderData += id.textContent + "_naming=" + naming.textContent + ";"
								sendRequest("post", "/postdata", "orderName=" + currentOrderName + "&orderData="
										+ orderData, function()
								{
								})
							}
							if (id.textContent ? id.textContent == "" : true)
								sendRequest(
										"get",
										"/getdata",
										"orderName=" + currentOrderName + "&",
										function(text3)
										{
											var orders2 = [];
											for (var v = 0; v < text3.split("&").length; v++)
												if (text3.split("&")[v] != "")
												{
													if (!orders2[text3.split("&")[v].split("=")[0].split("_")[0]])
														orders2[text3.split("&")[v].split("=")[0].split("_")[0]] = {};
													orders2[text3.split("&")[v].split("=")[0].split("_")[0]][text3
															.split("&")[v].split("=")[0].split("_")[1]] = text3
															.split("&")[v].split("=")[1]
												}
											id.textContent = orders2.length
											onOk()
										})
							else onOk()
						}
						recalcCost();
					}
					for (var v = 0; v < rows.length; v++)
						func(v)
					setSelectable(selectablesModel[3])
				}
				sendRequest("get", "/getdata", "orderName=" + currentOrderName + "&", onFunc2);
			};
			sendRequest("get", "/getdata", "orderOfferSearch=" + req + "&", onFunc);
			break
			
		case "orderedTableBody":
			setSelectable(selectablesModel[3])
			break
	}
}

var currentOrderName

function fillTable(id, rows)
{
	var head = document.getElementById(id + "Head");
	var table = document.getElementById(id + "Body");
	var tableStructure = id == 'orderFormsTable' ? orderFormsTableStructure
			: id == 'orderOffersTable' ? orderOffersTableStructure : tableStructure;
	var bcr=table.getBoundingClientRect()
	var tableW=bcr.right-bcr.left
	var tableH=bcr.bottom-bcr.top

	head.innerHTML = "";
	table.innerHTML = "";
	var ths = "";
	for (var v2 = 0; v2 < tableStructure.length; v2++)
		ths += "<th>" + tableStructure[v2].head + "</th>";
	head.innerHTML += "<tr>" + ths + "</tr>";
	var content = "";
	for (var v = 0; v < rows.length; v++)
	{
		var tds = "";
		var optionNum = -1;
		for (var v2 = 0; v2 < tableStructure.length; v2++)
			tds += "<td style='padding: 0px;"+(tableStructure[v2].width?"width: "+tableStructure[v2].width*tableW+"px":"")+"' class='"
					+ (tableStructure[v2].selectableClassType ? tableStructure[v2].selectableClassType + "-"
							+ table.id + "-" + v + " " : "")
					+ table.id
					+ "-"
					+ v
					+ "-"
					+ tableStructure[v2].name
					+ "' >"
					+ (tableStructure[v2].editType ? "<input onfocus='inputFocus(this,\"interface\")' onblur='inputUnfocus(this,\""+table.id + "-" + v + "-" + tableStructure[v2].name+"\")' class='" + table.id + "-" + v + "-"
							+ tableStructure[v2].name + "-" + "editor " + "selectable-"
							+ table.id.replace("Body", "Fields") + v + "-" + (optionNum++)
							+ "  focusElementOfSelectable-" + table.id.replace("Body", "Fields") + v
							+ " browserStyle' style='magin: 0px;width: 100%' type='" + tableStructure[v2].editType + "' value='"
							: "")
					+ (rows[v][tableStructure[v2].name] != undefined
							&& rows[v][tableStructure[v2].name] != null ? rows[v][tableStructure[v2].name] : "")
					+ (tableStructure[v2].editType ? "'/>" : "") + "</td>";
		content += "<tr id='" + table.id.replace("Body", "Fields") + v + "' class='selectable-" + table.id
				+ "-" + v + "'>" + tds + "</tr>";
	}
	table.innerHTML = content;

	updateTableResizers();
}
var foof=false
function inputFocus(el, newParentId)
{
	var lastParent=el.parentNode
	var bcr = lastParent.getBoundingClientRect()
	var bounds={}
	for(var key in bcr)
		bounds[key]=bcr[key]+""

	if (document.getElementById(newParentId) !== el.parentNode)
	{
		el.parentNode.removeChild(el)
		document.getElementById(newParentId).appendChild(el)
	//}

	//if(!foof)
	//{
		el.style.position = "fixed"
		el.style.left = bounds.left+"px"
		el.style.right = bounds.right+"px"
		el.style.top = bounds.top+"px"
		el.style.bottom = bounds.bottom+"px"
		
		el.style.width = bounds.width+"px"
		el.style.height = bounds.height+"px"
	
		if(lastParent.id!=="interface")
		{
			lastParent.style.width = bounds.width+"px"
			lastParent.style.height = bounds.height+"px"
		}
	}
	else foof=false
	
	setTimeout(function()
	{
		foof=true
		el.focus()
	}, 50)
}

function inputUnfocus(el, newParentId)
{
	if (document.getElementsByClassName(newParentId)[0] !== el.parentNode)
	{
		el.parentNode.removeChild(el)
		document.getElementsByClassName(newParentId)[0].innerHTML=""
		document.getElementsByClassName(newParentId)[0].appendChild(el)
	}
	
	el.style.position = ""
	el.style.left = ""
	el.style.right = ""
	el.style.top = ""
	el.style.bottom = ""

	el.style.width = "100%"
	el.style.height = "100%"
}
function updateTableResizers()
{
	var resizers = document.getElementsByClassName("tableResizer");
	for (var v = 0; v < resizers.length; v++)
		resizers[v].parentNode.removeChild(resizers[v]);
	var func = function(th, next)
	{
		var tableResizer = document.createElement("div");
		tableResizer.setAttribute("class", "tableResizer");
		tableResizer.style.width = "7px"
		tableResizer.style.height = "100%"
		tableResizer.style.position = "absolute"
		tableResizer.style.top = "0px"
		tableResizer.style.right = "-5px"
		tableResizer.style["z-index"] = 90
		tableResizer.style.cursor = "e-resize"

		var downed = false
		var last;

		tableResizer.onmousedown = function(e)
		{
			if (e.which == 1)
				downed = true;
		}
		document.addEventListener("mouseup", function(e)
		{
			if (e.which == 1)
				downed = false;
		})
		document.addEventListener("mousemove",
				function(e)
				{
					if (downed)
					{
						var w1 = th.style.width;
						var w2 = next.style.width;
						th.style.width = e.pageX - th.getBoundingClientRect().left - 7 / 2;
						next.style.width = next.getBoundingClientRect().right - e.pageX - 7 / 2;
						if (Math.abs(Number.parseInt(getComputedStyle(th).width)
								- Number.parseInt(th.style.width)) > 2)
						{
							th.style.width = w1;
							next.style.width = w2;
						}
					}
				})
		document.addEventListener("selectstart", function(e)
		{
			if (downed)
				e.preventDefault();
		})

		th.appendChild(tableResizer)
		th.style.position = "relative"
		th.style.width = getComputedStyle(th).width

		next.style.position = "relative"
		next.style.width = getComputedStyle(next).width
	}
	var ths = document.getElementsByTagName("th");
	for (var v = 0; v < ths.length; v++)
		if (ths[v].parentNode.children[ths[v].parentNode.children.length - 1] != ths[v])
			func(ths[v], ths[v + 1])
}