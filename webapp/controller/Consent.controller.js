/**
 * @author Prasenjit Paul
 */
sap.ui.define([
	"glb/farms/mobile/controller/BaseController",
	'glb/farms/mobile/util/Formatter',
	'sap/m/MessageBox',
	'sap/m/MessageToast',
	'sap/ui/core/ValueState',
	'sap/ui/core/Fragment',
	'sap/ui/model/Context',
	"sap/ui/model/json/JSONModel",
], function (BaseController, Formatter, MessageBox, MessageToast, ValueState, JSONModel) {
	"use strict";

	return BaseController.extend("glb.farms.mobile.controller.FarmerConsent", {
		onInit: function () {
			BaseController.prototype.onInit.call(this);
			this.getView().byId("html").setContent("<canvas id='signature-pad' width='400' height='200' class='signature-pad'></canvas>");
		},
		onRouteMatched: function (oEvent) {
			if (oEvent.getParameter("name") === "FarmerConsent") {
				this.showHideBackButton(false);
				this.showHideFwdButton(false);
				this.showHideCancelButton(false);
				this.consentData = {};
				this._entityId = oEvent.getParameter('arguments').entityId;
				this._groupId = oEvent.getParameter('arguments').groupId;
				var index = oEvent.getParameter('arguments').index;
				var entityPerson = this.getModel("LocalDataModel").getProperty("/EntityPersons/" + index);
				this._personId = entityPerson.personId;
				this._entityName = this.getModel("LocalDataModel").getProperty("/dashboardData_Entity/name");
				this._pathFileStorage = "";
				if (device.platform === "Android") {
					this._pathFileStorage = cordova.file.externalRootDirectory;
				} else if (device.platform === "iOS") {
					this._pathFileStorage = cordova.file.cacheDirectory;
				}
				var dataExchangeModel = this.getDataExchngModel();
				dataExchangeModel.setProperty('/containerView/headerText', this._entityName);
				dataExchangeModel.setProperty('/containerView/subHeaderText', entityPerson.personInfo_firstName + " " + entityPerson.personInfo_lastName);
				dataExchangeModel.setProperty('/containerView/subHeaderTextVisible', true);
				this.getDataExchngModel().setProperty('/containerView/backButtonRouter', {
					url: 'EntityInformation',
					currentPage: 'FarmerConsent',
					config: {
						entityId: this._entityId,
						groupId: this._groupId
					}
				});
				this.imageModel = new sap.ui.model.json.JSONModel();
				this.getModel("LocalDataModel").setProperty("/ConsentTaken", false);
				this.readPDFConsent();
			}
		},
		readPDFConsent: function () {
			this.showBusyDialog();
			var data = {};
			this.getModel().read("/Consents", {
				urlParameters: {
					$filter: "entityId eq '" + this._entityId + "' and personId eq '" + this._personId + "'"
				},
				success: $.proxy(function (data2) {
					if (data2 && data2.results.length > 0) {
						this.consentData = data2.results[0];
						this.getModel("LocalDataModel").setProperty("/ConsentTaken", false);
						this.getModel("ImageModel").read("/ConsentAttachments", {
							urlParameters: {
								$filter: "owningRecordId eq '" + data2.results[0].consentId + "'"
							},
							success: $.proxy(function (data3) {
								if (data3 && data3.results.length > 0) {
									data.ImageList = data3.results;
									data.ImageList[0].consentId = data2.results[0].consentId;
									data.ImageList[0].consentMetaData = data2.results[0].__metadata;
									this.imageModel.setData(data);
								} else {
									data.ImageList = [];
									this.imageModel.setData(data);
									this.getModel("LocalDataModel").setProperty("/ConsentTaken", true);
								}
								this.getView().setModel(this.imageModel, "ConsentImageLocalModel");
								this.byId("idConsenttImageList").rerender();
								this.hideBusyDialog();
							}, this),
							error: $.proxy(function (e) {
								console.log(e);
							}, this)
						});
					} else {
						data.ImageList = [];
						this.imageModel.setData(data);
						this.getModel("LocalDataModel").setProperty("/ConsentTaken", true);
						this.getView().setModel(this.imageModel, "ConsentImageLocalModel");
						this.byId("idConsenttImageList").rerender();
						this.hideBusyDialog();
					}
				}, this),
				error: $.proxy(function (e) {
					console.log(e);
				})
			});
		},
		// Capture Document Image and convert to PDF byte64 format 
		// and save it.

		onCameraPress: function (oEvent) {
			if (this.imageModel.oData.ImageList.length === 0) {
				this.showBusyDialog();
				var cameraQuality = device.platform === "Android" ? 50 : 10;
				var destinationtype = null;
				if (device.platform === "Android") {
					destinationtype = Camera.DestinationType.FILE_URI;
				} else if (device.platform === "iOS") {
					destinationtype = Camera.DestinationType.NATIVE_URI;
				}
				navigator.camera.getPicture($.proxy(function cameraSuccess(imageUri) {
					if (device.platform === "iOS") {
						imageUri = imageUri.replace("assets-library://", "cdvfile://localhost/assets-library/");
					}
					this.generatePDF(imageUri);
				}, this), $.proxy(function cameraError(error) {
					console.debug("Unable to obtain picture: " + error, "app");
					this.hideBusyDialog();
				}, this), {
					quality: cameraQuality,
					destinationType: destinationtype,
					saveToPhotoAlbum: true,
					targetHeight: 800,
					targetWidth: 600,
					correctOrientation: true
				});
				this.hideBusyDialog();
			} else {
				this.showMessage("MESSAGE_CONSENT_MULTI_IMAGE_NOT_ALLOWED");
			}
		},
		// Delete PDF document on Press on delete button.
		onDeletePress: function (oEvent) {
			MessageBox.confirm(this.getTextFromBundle("MESSAGE_CONFIRM_DELETE_IMAGE"), {
				title: "Confirm",
				onClose: $.proxy(function (oAction) {
					if (oAction === MessageBox.Action.OK) {
						this.removePDFDocument();
					}
				}, this)
			});
		},
		onPreviewPDF: function (oEvent) {
			var pdfBase64 = this.getView().getModel("ConsentImageLocalModel").getProperty("/ImageList/0/binaryObject");
			var contentType = "application/pdf";
			var folderpath = this._pathFileStorage;
			var filename = "tmp-farmer-consent.pdf";
			this.savebase64AsPDF(folderpath, filename, pdfBase64, contentType);
		},
		onPressDone: function (oEvent) {
			var path = this._pathFileStorage;
			var filename = "tmp-farmer-consent.pdf";
			window.resolveLocalFileSystemURL(path, function (dir) {
				dir.getFile(filename, {
					create: false
				}, function (fileEntry) {
					fileEntry.remove(function () {
						// The file has been removed succesfully
					}, function (error) {
						// Error deleting the file
					}, function () {
						// The file doesn't exist
					});
				});
			});
			this.getRouter().navTo("EntityInformation", {
				entityId: this._entityId,
				groupId: this._groupId
			}, this);
		},
		generatePDF: function (oEvent) {
			// var imageObj = this.getView().getModel("ConsentImageLocalModel").getProperty("/ImageList/0");
			var canvas = document.getElementById("signature-pad");
			var data_pdf = "<html> <h1>" + this.getTextFromBundle("MESSAGE_FARMER_CONSENT") + "</h1>"
				+ "<body><p>" + canvas + "</p>"
				+ "</body></html>";
			pdf.htmlToPDF({
					data: data_pdf,
					documentSize: "A4",
					landscape: "portrait",
					type: "base64"
				},
				$.proxy(function (base64PDF) {
					this.savePDFDocument(base64PDF);
				}, this),
				function (e) {
					console.log(e);
					this.hideBusyDialog();
				}
			);
		},
		savePDFDocument: function (base64PDF) {
			/* this.getModel().read("/Consents",{
				urlParameters: {
                    $filter: "entityId eq '" + this._entityId + "' and personId eq '" + this._personId + "'"
                },
				success: $.proxy(function(data){
					console.log(data);
				},this),
				error: $.proxy(function(e){
					console.log(e);
				},this)
			});*/
			if (this.consentData.consentId !== undefined) {
				this.attachmentId = this.getGUID();
				var attachment = {
					attachmentId: this.attachmentId,
					owningRecordId: this.consentData.consentId,
					owningRecordType: "CONSENT",
					status: "ACTIVE",
					documentType: "DOCUMENT",
					mimeType: "application/pdf",
					fileName: null,
					binaryObject: base64PDF
				};
				this.getModel("LocalDataModel").setProperty("/ConsentTaken", false);

				//delta
				this.getModel("ImageModel").setHeaders(AppRegistrationModule.getCustomHeader());

				this.getModel("ImageModel").create("/ConsentAttachments", attachment, {
					success: $.proxy(function (createdObj) {

						//delta
						this.getModel("ImageModel").setHeaders(AppRegistrationModule.removeCustomHeader());

						this.setUserSyncStatus(1);
						this.hideBusyDialog();
						var imageList = this.getView().getModel("ConsentImageLocalModel").getProperty("/ImageList");
						createdObj.consentId = this.consentData.consentId;
						createdObj.consentMetaData = this.consentData.__metadata;
						imageList.push(createdObj);
						this.getView().getModel("ConsentImageLocalModel").setProperty("/ImageList", imageList);
						this.updatePeople(1);
						this.onPreviewPDF();
					}, this),
					error: $.proxy(function (error) {
						//delta
						this.getModel("ImageModel").setHeaders(AppRegistrationModule.removeCustomHeader());
						console.log(error);
						this.hideBusyDialog();
						this.showMessage("MESSAGE_SYNC_ERROR");
					}, this)
				});
			} else {
				var consents = {
					consentId: this.getGUID(),
					consentType: "CONSENT",
					personId: this._personId,
					entityId: this._entityId,
					isMobile: 1
				};

				//delta
				this.getModel().setHeaders(AppRegistrationModule.getCustomHeader());

				this.getModel().create("/Consents", consents, {
					success: $.proxy(function (data) {

						this.getModel().setHeaders(AppRegistrationModule.removeCustomHeader());
						this.attachmentId = this.getGUID();
						var attachment = {
							attachmentId: this.attachmentId,
							owningRecordId: data.consentId,
							owningRecordType: "CONSENT",
							status: "ACTIVE",
							documentType: "DOCUMENT",
							mimeType: "application/pdf",
							fileName: null,
							binaryObject: base64PDF
						};
						this.getModel("LocalDataModel").setProperty("/ConsentTaken", false);

						//delta
						this.getModel("ImageModel").setHeaders(AppRegistrationModule.getCustomHeader());

						this.getModel("ImageModel").create("/ConsentAttachments", attachment, {
							success: $.proxy(function (createdObj) {
								//delta
								this.getModel("ImageModel").setHeaders(AppRegistrationModule.removeCustomHeader());
								this.setUserSyncStatus(1);
								this.hideBusyDialog();
								var imageList = this.getView().getModel("ConsentImageLocalModel").getProperty("/ImageList");
								createdObj.consentId = data.consentId;
								createdObj.consentMetaData = data.__metadata;
								imageList.push(createdObj);
								this.getView().getModel("ConsentImageLocalModel").setProperty("/ImageList", imageList);
								this.updatePeople(1);
								this.onPreviewPDF();
							}, this),
							error: $.proxy(function (error) {
								//delta
								this.getModel("ImageModel").setHeaders(AppRegistrationModule.removeCustomHeader());
								console.log(error);
								this.hideBusyDialog();
								this.showMessage("MESSAGE_SYNC_ERROR");
							}, this)
						});
					}, this),
					error: $.proxy(function (e) {
						console.log(e);
						this.getModel().setHeaders(AppRegistrationModule.removeCustomHeader());
					}, this)
				});
			}
		},
		removePDFDocument: function () {
			var objList = this.getView().getModel("ConsentImageLocalModel").getProperty("/ImageList");
			var obj = objList[0];
			// this.getModel().remove("/Consents('" + obj.consentId + "')", {
			eTag: obj.consentMetaData.etag,
				//  success: $.proxy(function () {
				this.getModel("ImageModel").remove("/ConsentAttachments('" + obj.attachmentId + "')", {
					eTag: obj.__metadata.etag,
					success: $.proxy(function () {
						this.setUserSyncStatus(1);
						this.hideBusyDialog();
						objList.splice(0, 1);
						this.getModel("LocalDataModel").setProperty("/ConsentTaken", true);
						this.getView().getModel("ConsentImageLocalModel").setProperty("/ImageList", objList);
						this.byId("idConsenttImageList").rerender();
						this.updatePeople(0);
					}, this),
					error: $.proxy(function (error) {
						console.log(error);
						this.hideBusyDialog();
						this.showMessage("MESSAGE_SYNC_ERROR");
					}, this)
				});
			//  }, this),

			//   });
		},
		// Convert PDF 64Byte to Blob. Required for PDF display

		b64toBlob: function (b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;
			var byteCharacters = atob(b64Data);
			var byteArrays = [];
			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);
				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}
				var byteArray = new Uint8Array(byteNumbers);
				byteArrays.push(byteArray);
			}
			var blob = new Blob(byteArrays, {
				type: contentType
			});
			return blob;
		},
		// Save PDF file in external file directory
		savebase64AsPDF: function (folderpath, filename, content, contentType) {
			// Convert the base64 string in a Blob
			var DataBlob = this.b64toBlob(content, contentType);
			//	console.log("Starting to write the file :3");		
			window.resolveLocalFileSystemURL(folderpath, function (dir) {
				//	console.log("Access to the directory granted succesfully");
				dir.getFile(filename, {
					create: true
				}, function (file) {
					//	console.log("File created succesfully.");
					file.createWriter(function (fileWriter) {
						//  console.log("Writing content to file");
						fileWriter.write(DataBlob);
						cordova.plugins.fileOpener2.open(
							folderpath + "/" + filename,
							contentType, {
								error: function (e) {
									console.log('Error status: ' + e.status + ' - Error message: ' + e.message);
								},
								success: function () {
									//	console.log('file opened successfully'); 				
								}
							}
						);
					}, function () {
						this.showMessage("FARMER_CONSENT_PDF_FILE_SAVE");
					});
				});
			});
		},
		updatePeople: function (value) {
			this.showBusyDialog();
			var hasConsentObj = {
				"hasConsent": value
			};
			this.getModel().read("/Persons", {
				urlParameters: {
					$filter: "personId eq '" + this._personId + "'"
				},
				success: $.proxy(function (data) {
					if (data && data.results.length > 0) {
						this.getModel().update("/Persons('" + this._personId + "')", hasConsentObj, {
							eTag: data.results[0].__metadata.etag,
							success: $.proxy(function () {
								//     console.log("succesfully updated");
								this.hideBusyDialog();
							}, this),
							error: $.proxy(function (e) {
								console.log(e);
								this.hideBusyDialog();
							}, this)
						});
					}
				}, this),
				error: $.proxy(function (e) {
					console.log(e);
				}, this)
			});
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