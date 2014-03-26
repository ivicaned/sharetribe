window.ST = window.ST || {};

window.ST.imageUploader = function(listings, opts) {
  var $container = $("#image-uploader-container");
  var $upload = $("#new-image-tmpl");
  var $thumbnail = $("#thumbnail-image-tmpl");
  var directUploadToS3 = !!opts.s3;

  function renderUploader() {
    var fileInputName = directUploadToS3 ? "file" : "listing_image[image]";
    var uploadTmpl = _.template($upload.html(), {fileInputName: fileInputName});

    $container.html(uploadTmpl);

    function processing() {
      showMessage(ST.t("listings.form.images.processing"), ST.t("listings.form.images.this_may_take_a_while"));
    }

    function showMessage(normal, small) {
      var $normalEl = $(".fileupload-text", $container);
      var $smallEl = $(".fileupload-small-text", $container);

      if(normal) {
        $normalEl.text(normal);
      } else {
        $normalEl.empty();
      }

      if(small) {
        $smallEl.text(small);
      } else {
        $smallEl.empty();
      }
    }

    function updatePreview(result, delay) {
      debugger;
      $.get(result.urls.status, function(statusResult) {
        debugger;
        if(statusResult.processing || !statusResult.downloaded) {
          processing();
          _.delay(function() {
            updatePreview(result, delay + 500);
          }, delay + 500);
        } else {
          renderThumbnail({thumbnailUrl: statusResult.images.thumb, removeUrl: statusResult.urls.remove});
        }
      });
    }

    function onProgress(e, data) {
      var percentage = Math.round((data.loaded / data.total) * 100);
      showMessage(ST.t("listings.form.images.percentage_loaded", {percentage: percentage}));
    }

    function s3uploadDone(data) {
      var key = data.formData.key;
      var filename = data.files[0].name;
      var s3ImageUrl = opts.s3.uploadPath + key.replace("${filename}", filename);
      
      $.ajax({
        type: "PUT",
        url: opts.saveFromUrl,
        data: {
          image_url: s3ImageUrl
        },
        success: function(result) {
          listingImageSavingDone(result);
        },
        fail: imageUploadingFailed
      });
    }

    function listingImageSavingDone(result) {
      $("#listing-image-id").val(result.id);

      updatePreview(result, 2000);
    }

    function imageUploadingFailed() {
      showMessage(ST.t("listings.form.images.uploading_failed"));
    }

    function imageUploadingDone(e, data) {
      if(directUploadToS3) {
        s3uploadDone(data);
      } else {
        listingImageSavingDone(data.result);
      }
    }

    $(function() {
      $('#fileupload').fileupload({
        dataType: 'json',
        url: directUploadToS3 ? opts.s3.uploadPath : opts.saveFromFile,
        dropZone: $('#fileupload'),
        progress: onProgress,
        acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i,
        imageMaxWidth: opts.originalImageWidth,
        imageMaxHeight: opts.originalImageHeight,
        loadImageMaxFileSize: opts.maxImageFilesize,
        messages: {
          acceptFileTypes: ST.t("listings.form.images.accepted_formats"),
          maxFileSize: ST.t("listings.form.images.file_too_large"),
        },
        processfail: function (e, data) {
          var firstError = _(data.files).pluck('error').first();
          showMessage(null, firstError);
        },
        // Enable image resizing, except for Android and Opera,
        // which actually support image resizing, but fail to
        // send Blob objects via XHR requests:
        disableImageResize: /Android(?!.*Chrome)|Opera/.test(window.navigator && navigator.userAgent),
        submit: function(e, data) {
          if(directUploadToS3) {
            data.formData = _.extend(opts.s3.options, {
              "Content-Type": data.files[0].type
            });
          }
        },
        done: imageUploadingDone,
        fail: imageUploadingFailed
      }).on('dragenter', function() {
        $(this).addClass('hover');
      }).on('dragleave', function() {
        $(this).removeClass('hover');
      });
    });
  }

  function renderThumbnail(listing) {
    var $thumbnailElement = $(_.template($thumbnail.html(), {thumbnailUrl: listing.images.thumb}));

    $('.fileupload-preview-remove-image', $thumbnailElement).click(function(e) {
      e.preventDefault();

      $(".fileupload-removing").show();

      $.ajax({
        url: listing.urls.remove,
        type: 'DELETE',
        success: function() {
          $container.empty();
          $(".fileupload-removing").hide();
          renderUploader();
        },
      });
    });

    $container.html($thumbnailElement);
  }

  if(listings.length === 0) {
    renderUploader();
  } else {
    listings.forEach(renderThumbnail);
  }
};