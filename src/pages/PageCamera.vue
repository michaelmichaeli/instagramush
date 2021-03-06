<template>
  <q-page class="constrain-more q-pa-md">
    <div class="camera-frame q-pa-md">
      <video
        ref="video"
        class="full-width"
        autoplay
        playsinline
        v-show="!imageCaptured"
      />

      <canvas
        v-show="imageCaptured"
        ref="canvas"
        class="full-width"
        height="240"
      />
    </div>

    <div class="text-center q-pa-md">
      <q-btn
        v-if="hasCameraSupport"
        @click="captureImage"
        :disable="imageCaptured"
        round
        color="grey-10"
        icon="eva-camera"
        size="lg"
      />

      <q-file
        v-else
        filled
        bottom-slots
        v-model="imageUpload"
        label="Choose an image"
        accept="image/*"
        @input="captureImageFallback"
      >
        <template v-slot:prepend>
          <q-icon name="eva-cloud-upload-outline" @click.stop />
        </template>
      </q-file>

      <div class="row justify-center q-pa-md">
        <q-input
          v-model="post.caption"
          label="Caption *"
          dense
          class="col col-sm-6"
        />
      </div>

      <div class="row justify-center q-pa-md">
        <q-input
          v-model="post.location"
          :loading="locationLoading"
          label="Location"
          dense
          class="col col-sm-6"
        >
          <template v-slot:append>
            <q-btn
              v-if="!locationLoading && locationSupported"
              round
              dense
              flat
              icon="eva-navigation-2-outline"
              @click="getLocation"
            />
          </template>
        </q-input>
      </div>
    </div>

    <div class="row justify-center q-mt-lg">
      <q-btn
        unelevated
        rounded
        color="primary"
        label="Post Image"
        @click="addPost()"
        :disable="!post.caption || !post.photo"
      />
    </div>
  </q-page>
</template>

<script>
import { uid } from "quasar";
require("md-gum-polyfill");

export default {
  name: "PageCamera",
  data() {
    return {
      post: {
        id: uid(),
        caption: "",
        location: "",
        photo: null,
        date: Date.now()
      },
      imageCaptured: false,
      imageUpload: [],
      hasCameraSupport: true,
      locationLoading: false
    };
  },
  computed: {
    locationSupported() {
      return "geolocation" in navigator;
    }
  },
  methods: {
    initCamera() {
      navigator.mediaDevices
        .getUserMedia({
          video: true
        })
        .then(stream => {
          this.$refs.video.srcObject = stream;
        })
        .catch(err => {
          this.hasCameraSupport = false;
        });
    },
    captureImage() {
      let video = this.$refs.video;
      let canvas = this.$refs.canvas;
      canvas.width = video.getBoundingClientRect().width;
      canvas.height = video.getBoundingClientRect().height;
      let context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.imageCaptured = true;
      this.post.photo = this.dataURItoBlob(canvas.toDataURL());
      this.disableCamera();
    },
    captureImageFallback(file) {
      this.post.photo = file;

      let canvas = this.$refs.canvas;
      let context = canvas.getContext("2d");

      var reader = new FileReader();
      reader.onload = event => {
        var img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
          this.imageCaptured = true;
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    },
    disableCamera() {
      this.$refs.video.srcObject
        .getVideoTracks()
        .forEach(track => track.stop());
    },
    dataURItoBlob(dataURI) {
      // convert base64 to raw binary data held in a string
      // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
      var byteString = atob(dataURI.split(",")[1]);

      // separate out the mime component
      var mimeString = dataURI
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];

      // write the bytes of the string to an ArrayBuffer
      var ab = new ArrayBuffer(byteString.length);

      // create a view into the buffer
      var ia = new Uint8Array(ab);

      // set the bytes of the buffer to the correct values
      for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      // write the ArrayBuffer to a blob, and you're done
      var blob = new Blob([ab], { type: mimeString });
      return blob;
    },
    getLocation() {
      this.locationLoading = true;
      navigator.geolocation.getCurrentPosition(
        position => {
          console.log("pos: ", position);
          this.getCityAndCountry(position);
        },
        err => this.locationError(),
        { timeout: 10000 }
      );
    },
    getCityAndCountry(position) {
      let apiUrl = `https://geocode.xyz/${position.coords.latitude},${position.coords.longitude}?json=1`;
      this.$axios
        .get(apiUrl)
        .then(result => {
          console.log("cityAndCountry:", result.data);
          this.locationSuccess(result.data);
        })
        .catch(err => this.locationError());
    },
    locationSuccess(cityAndCountry) {
      this.post.location = cityAndCountry.city;
      if (cityAndCountry.country)
        this.post.location += `, ${cityAndCountry.country}`;
      this.locationLoading = false;
    },
    locationError() {
      console.log("err");
      this.$q.dialog({
        title: "Oops",
        message: "Could not find your location."
      });
      this.locationLoading = false;
    },
    addPost() {
      this.$q.loading.show();

      let formData = new FormData();
      formData.append("id", this.post.id);
      formData.append("caption", this.post.caption);
      formData.append("location", this.post.location);
      formData.append("date", this.post.date);
      formData.append("file", this.post.photo, this.post.id + ".png");

      this.$axios
        .post(`${process.env.API}/createPost`, formData)
        .then(response => {
          // console.log("response", response);
          this.$router.push("/");
          this.$q.notify({
            message: "Post created!",
            actions: [{ label: "Dismiss", color: "white" }]
          });
          this.$q.loading.hide();
        })
        .catch(err => {
          this.$q.dialog({
            title: "Error",
            message: "Sorry, could not create post!."
          });
          this.$q.loading.hide();
        });
    }
  },
  mounted() {
    this.initCamera();
    setTimeout(() => {
      this.getLocation();
    },4000);
  },
  beforeDestroy() {
    if (this.hasCameraSupport) this.disableCamera();
  }
};
</script>

<style lang="sass">
.camera-frame
  border: 2px solid $grey-10
  border-radius: 10px
</style>
