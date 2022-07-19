import * as THREE from "three";

function IKrig(){

    this.tpose = null;
    this.pose = null;
    this.chains = {};
    this.map = {};
}

/**
 * 
 * @param {String} chainName 
 * @param {Array of strings} jointsNames 
 * @param {Bone} endEffector 
 * @param {Object3D} target 
 */
IKrig.prototype.addChain = function(chainName, jointsNames, endEffector, target){
    
    let chain = new Chain();
    chain.endEffector  = endEffector;
    chain.target = target;
    
    for(let i = 0; i < jointsNames.length; i++){
        let name = jointsNames[i];
        let joint = this.tpose[this.map[name]];
        chain.joints.push(joint);
    }
    
    this.chains[chainName] = chain;
}

IKrig.prototype.setBindPose = function(skeleton, updateWorld = false){
    
    this.tpose = this.getBindPose(skeleton, updateWorld);

}

IKrig.prototype.getBindPose = function(skeleton, updateWorld = false){
    
    let bones = [];
    
    for(let i = 0; i<skeleton.bones.length; i++){
        map[skeleton.bones[i].name] = i;
    }

    for(let i = 0; i<skeleton.bones.length; i++){
        let bone = new THREE.Bone();
        bone.name = skeleton.bones[i].name;
        let parent = skeleton.bones[i].parent;
        bone.parent = bones[map[parent.name]];
        // If no parent bone, The inverse is enough
        let bindMatInverse = skeleton.boneInverses[i];
        let mat = new THREE.Matrix4();
        mat.fromArray(bindMatInverse);
        mat = bindMatInverse.clone();
       // mat.elements = new Float32Array(mat.elements);
        mat.invert(); 	// Child Bone UN-Inverted

        // if parent exists, keep it parent inverted since thats how it exists in gltf
        // BUT invert the child bone then multiple to get local space matrix.
        // parent_worldspace_mat4_invert * child_worldspace_mat4 = child_localspace_mat4
        //  child_worldspace_mat4 = parent_worldspace_mat4 *child_localspace_mat4
        if (parent && !parent.name.toUpperCase().includes("ARMATURE")) { 
            let pBindMatInverse = skeleton.boneInverses[map[parent.name]];
            let pmat = new THREE.Matrix4();
            pmat.fromArray(pBindMatInverse); // Parent Bone Inverted
            pmat = pBindMatInverse.clone();
            //pmat.elements = new Float32Array(pmat.elements);
            mat.multiplyMatrices(pmat,mat);	
        }  
        else if(parent.name.toUpperCase().includes("ARMATURE"))
        {
            bone.parent = parent;
        }

        bone.matrix.copy(mat)

        //Assign local position
        let pos = mat.getPosition();
        bone.position.copy(pos.round2zero());
        
        //Assign local rotation
        let rot = new THREE.Quaternion().fromArray(mat.getRotationNormalized(new Float32Array(4)));
        bone.quaternion.copy(rot.normalize());
        
        //Assign local scale
        let scale = new THREE.Vector3().fromArray(mat.getScale());
        bone.scale.copy(scale)//scale.multiplyScalar(0.5) );

        bone.updateMatrixWorld();
              
        bones.push( bone );
    }
    // Compute the model Local & World Transform Bind Pose
    // THREE will compute the inverse matrix bind pose on its own when bones are given to THREE.Skeleton

    let b, p;
    for( b of bones ){
        //------------------------------------------
        // Compute its world space transform based on parent's ws transform.
        b.world = {
            pos : new THREE.Vector3(),
            rot : new THREE.Quaternion(),
            scl : new THREE.Vector3()
        }
       if( b.parent != null && !b.parent.name.toUpperCase().includes("ARMATURE"))
        {
            p = bones[ map[b.parent.name] ];
            
            //------------------------------------------
            // POSITION - parent.position + ( parent.rotation * ( parent.scale * child.position ) )
            let v = new THREE.Vector3();
            v.multiplyVectors( p.world.scl, b.position ); // parent.scale * child.position;
			v.applyQuaternion( p.world.rot ); //Vec3.transform_quat( v, tp.rot, v );
			b.world.pos.addVectors( p.world.pos, v ); // Vec3.add( tp.pos, v, this.pos );

			//------------------------------------------
			// SCALE - parent.scale * child.scale
			b.world.scl.multiplyVectors( p.world.scl, b.scale );

			//------------------------------------------
			// ROTATION - parent.rotation * child.rotation
			//this.rot.from_mul( tp.rot, tc.rot );
            b.world.rot.multiplyQuaternions(p.world.rot, b.quaternion)

           /* b.world.pos.addVectors(p.wolrd.pos, b.position);
            b.world.rot.addQuaternions(p.wolrd.pos, b.position);
            b.world.scl.addVectors(p.wolrd.pos, b.position);
            b.world.from_add( p.world, b.local );*/
        }else {
            b.world.pos.copy(b.position)  ;
            b.world.scl.copy(b.scale)  ;
            b.world.rot.copy(b.quaternion)  ;
        }
     
    }
    if(updateWorld){
        for( b of bones ){
           
            b.updateMatrix();
            b.updateWorldMatrix();
            b.getWorldPosition(b.world.pos); 
            b.getWorldQuaternion(b.world.rot); 
        }
    }
    return bones;
}


/**
 * Joints Chain class
 */
function Chain(){

    this.origin = null;
    this.endEffector = null;
    this.target = null;
    this.joints = [];
}

export {IKrig};