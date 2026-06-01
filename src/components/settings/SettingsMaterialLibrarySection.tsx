import { MaterialLibraryContent } from "@/components/MaterialLibraryContent";
import "@/components/MaterialLibrary.css";

export function SettingsMaterialLibrarySection() {
  return (
    <div className="settingsSection" id="settings-material-library">
      <div className="settingsSectionTitle">素材库</div>
      <p className="materialLibrarySettingsNote">
        也可通过画布左侧第二个按钮打开素材库。在节点右键可保存到人物 / 场景 / 物品 / 风格分类。
      </p>
      <div className="materialLibraryModal materialLibraryModal--embedded">
        <MaterialLibraryContent />
      </div>
    </div>
  );
}
