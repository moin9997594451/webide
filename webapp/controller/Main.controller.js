sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function (Controller) {
	"use strict";

	return Controller.extend("sap.moin.DigitalSignaturePad.controller.Main", {
		onInit: function () {
			this.getView().byId("html").setContent("<canvas id='signature-pad' width='400' height='200' class='signature-pad'></canvas>");
		},

		/******************Signature Pad Draw************************/

		onSign: function (oEvent) {
			var canvas = document.getElementById("signature-pad");
			var context = canvas.getContext("2d");
			canvas.width = 276;
			canvas.height = 180;
			context.fillStyle = "#fff";
			context.strokeStyle = "#444";
			context.lineWidth = 1.5;
			context.lineCap = "round";
			context.fillRect(0, 0, canvas.width, canvas.height);
			this.disableSave = true;
			this.pixels = [];
			var cpixels = [];
			this.xyLast = {};
			this.xyAddLast = {};
			this.calculate = false;
			canvas.addEventListener('touchstart', this.on_mousedown.bind(this), false);
			canvas.addEventListener('mousedown', this.on_mousedown.bind(this), false);

		},

		/***********Download the Signature Pad********************/

		saveButton: function (oEvent) {
			var canvas = document.getElementById("signature-pad");
			var link = document.createElement('a');
			link.href = canvas.toDataURL('image/jpeg');
			link.download = 'sign.jpeg';
			link.click();
			var signaturePad = new SignaturePad(document.getElementById('signature-pad'), {
				backgroundColor: '#ffffff',
				penColor: 'rgb(0, 0, 0)'
			});
		},

		/************Clear Signature Pad**************************/

		clearButton: function (oEvent) {
			var canvas = document.getElementById("signature-pad");
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height);

			var signaturePad = new SignaturePad(document.getElementById('signature-pad'), {
				backgroundColor: '#ffffff',
				penColor: 'rgb(0, 0, 0)',
				penWidth: '1'
			});
		},

		remove_event_listeners: function () {
			var canvas = document.getElementById("signature-pad");

			canvas.removeEventListener('mousemove', this.on_mousemove, false);
			canvas.removeEventListener('mouseup', this.on_mouseup, false);
			canvas.removeEventListener('touchmove', this.on_mousemove, false);
			canvas.removeEventListener('touchend', this.on_mouseup, false);

			document.body.removeEventListener('mouseup', this.on_mouseup, false);
			document.body.removeEventListener('touchend', this.on_mouseup, false);

		},

		get_coords: function (e) {
			var canvas = document.getElementById("signature-pad");

			var x, y;

			if (e.changedTouches && e.changedTouches[0]) {
				// var offsety = canvas.offsetTop || 0;
				// var offsetx = canvas.offsetLeft || 0;

				var canvasArea = canvas.getBoundingClientRect();
				var offsety = canvasArea.top || 0;
				var offsetx = canvasArea.left || 0;

				x = e.changedTouches[0].pageX - offsetx;
				y = e.changedTouches[0].pageY - offsety;
			} else if (e.layerX || 0 == e.layerX) {
				x = e.layerX;
				y = e.layerY;
			} else if (e.offsetX || 0 == e.offsetX) {
				x = e.offsetX;
				y = e.offsetY;
			}

			return {
				x: x,
				y: y
			};

		},

		on_mousedown: function (e) {
			var canvas = document.getElementById("signature-pad");
			var context = canvas.getContext("2d");
			
			e.preventDefault();
			e.stopPropagation();

			canvas.addEventListener('mouseup', this.on_mouseup, false);
			canvas.addEventListener('mousemove', this.on_mousemove, false);
			canvas.addEventListener('touchend', this.on_mouseup, false);
			canvas.addEventListener('touchmove', this.on_mousemove, false);
			document.body.addEventListener('mouseup', this.on_mouseup, false);
			document.body.addEventListener('touchend', this.on_mouseup, false);

			// empty = false;
			var xy = this.get_coords(e);
			context.beginPath();
			this.pixels.push('moveStart');
			context.moveTo(xy.x, xy.y);
			this.pixels.push(xy.x, xy.y);
			this.xyLast = xy;
		},

		on_mouseup: function (e) {
			var canvas = document.getElementById("signature-pad");
			var context = canvas.getContext("2d");
			
			this.remove_event_listeners();
			this.disableSave = false;
			context.stroke();
			this.pixels.push('e');
			this.calculate = false;
		},

		on_mousemove: function (e, finish) {
			var canvas = document.getElementById("signature-pad");
			var context = canvas.getContext("2d");
			
			e.preventDefault();
			e.stopPropagation();

			var xy = this.get_coords(e);
			var xyAdd = {
				x: (this.xyLast.x + xy.x) / 2,
				y: (this.xyLast.y + xy.y) / 2
			};

			if (this.calculate) {
				var xLast = (this.xyAddLast.x + this.xyLast.x + xyAdd.x) / 3;
				var yLast = (this.xyAddLast.y + this.xyLast.y + xyAdd.y) / 3;
				this.pixels.push(xLast, yLast);
			} else {
				this.calculate = true;
			}

			context.quadraticCurveTo(this.xyLast.x, this.xyLast.y, xyAdd.x, xyAdd.y);
			this.pixels.push(xyAdd.x, xyAdd.y);
			context.stroke();
			context.beginPath();
			context.moveTo(xyAdd.x, xyAdd.y);
			this.xyAddLast = xyAdd;
			this.xyLast = xy;

		}
	});
});