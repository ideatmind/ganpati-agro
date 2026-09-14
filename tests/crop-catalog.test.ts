import assert from "node:assert/strict";
import test from "node:test";
import { CROP_CATEGORIES, CLUSTER_OPTIONS } from "../src/shared/crop-catalog.ts";
import { registrationSchema } from "../src/features/registration/schema.ts";
import { profileChangesSchema } from "../src/features/registration/profile-schema.ts";

const registration = {
  name: "Crop Test", mobile: "8000000098", password: "test1234",
  aadhar_no: "123456789012", date_of_birth: "1990-01-01",
  village: "Test village", district: "dharashiv", taluka: "dharashiv",
  income_source: "agriculture", consent: true,
};

test("all 13 crop categories and their crops can be registered", () => {
  assert.deepEqual(CLUSTER_OPTIONS, ["cereals", "pulses", "oilseeds", "cash", "fruits", "vegs", "spices", "flowers", "medicinal", "mushroom", "allied", "protected", "agroforestry"]);
  assert.deepEqual(CROP_CATEGORIES.map(category => category.crops.length), [5, 6, 6, 3, 16, 18, 6, 6, 5, 3, 7, 6, 3]);
  for (const category of CROP_CATEGORIES) {
    assert.ok(profileChangesSchema.safeParse({cluster_type: category.id}).success);
    for (const crop of category.crops) {
      assert.ok(registrationSchema.safeParse({...registration, cluster_type: category.id, plots: [{plot_no: "1", area_acres: 1, crop_name: crop, irrigation_source: "well"}]}).success, `${category.id}: ${crop}`);
    }
  }
});

test("registration rejects crops and clusters outside the catalog", () => {
  const input = {...registration, cluster_type: "oilseeds", plots: [{plot_no: "1", area_acres: 1, crop_name: "सोयाबीन", irrigation_source: "well"}]};
  assert.ok(registrationSchema.safeParse(input).success);
  assert.equal(registrationSchema.safeParse({...input, cluster_type: "unknown"}).success, false);
  for (const crop_name of ["", "Unknown crop", "सिताफळ"]) {
    const result = registrationSchema.safeParse({...input, plots: [{...input.plots[0], crop_name}]});
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some(issue => issue.path.join(".") === "plots.0.crop_name"));
  }
});
